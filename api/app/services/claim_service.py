from datetime import datetime
from typing import Any

from app.core.ids import generate_claim_id, generate_zone_id
from app.db.mongo import now_utc
from app.models.claim import ClaimCreate
from app.repositories import attachment_repository, claim_repository, outbox_repository


def _build_zone(payload: ClaimCreate) -> dict[str, Any] | None:
    if payload.zone:
        zone = payload.zone.model_dump()
        if not zone.get("zone_id"):
            zone["zone_id"] = generate_zone_id(zone["name"])
        return zone
    if payload.carrier and payload.carrier.zone:
        zone_name = payload.carrier.zone
        return {"zone_id": generate_zone_id(zone_name), "name": zone_name, "region": None}
    return None


def _build_claim_document(
    claim_id: str, payload: ClaimCreate, now: datetime, evidence_summary: dict[str, Any]
) -> dict[str, Any]:
    priority = payload.details.get("priority", "media") if payload.details else "media"
    return {
        "_id": claim_id,
        "claim_id": claim_id,
        "claim_type": payload.claim_type,
        "channel": payload.channel,
        "current_status": "created",
        "created_at": now,
        "updated_at": now,
        "customer": payload.customer.model_dump(),
        "order": payload.order.model_dump(),
        "product": payload.product.model_dump(),
        "seller": payload.seller.model_dump(),
        "carrier": payload.carrier.model_dump() if payload.carrier else None,
        "zone": _build_zone(payload),
        "details": {**payload.details, "priority": priority},
        "evidence_summary": evidence_summary,
        "status_history": [
            {
                "current_status": "created",
                "actor_type": "customer",
                "actor_id": payload.customer.customer_id,
                "comment": "Reclamo registrado",
                "event_at": now,
            }
        ],
        "sla": {"status": "on_track", "breached": False},
        "graph_sync_status": "pending_sync",
    }


def create_claim(payload: ClaimCreate) -> dict[str, Any]:
    now = now_utc()
    claim_id = generate_claim_id()

    evidence_summary = attachment_repository.insert_attachments(
        claim_id, [item.model_dump() for item in payload.evidence], now
    )

    claim = _build_claim_document(claim_id, payload, now, evidence_summary)
    claim_repository.insert_claim(claim)

    outbox_repository.create_event(
        "ClaimCreated",
        claim_id,
        {
            "claim_id": claim_id,
            "customer_id": claim["customer"]["customer_id"],
            "product_id": claim["product"]["product_id"],
            "seller_id": claim["seller"]["seller_id"],
            "carrier_id": (claim.get("carrier") or {}).get("carrier_id"),
            "zone_id": (claim.get("zone") or {}).get("zone_id"),
            "claim_type": claim["claim_type"],
        },
    )

    return claim


def change_status(claim_id: str, new_status: str, comment: str | None, actor_id: str | None) -> int:
    now = now_utc()
    event = {
        "current_status": new_status,
        "actor_type": "agent",
        "actor_id": actor_id,
        "comment": comment or "Cambio de estado",
        "event_at": now,
    }
    matched_count = claim_repository.push_status_history(claim_id, new_status, event)
    if matched_count:
        outbox_repository.create_event(
            "ClaimStatusChanged",
            claim_id,
            {"claim_id": claim_id, "current_status": new_status},
        )
    return matched_count
