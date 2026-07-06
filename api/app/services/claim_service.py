from datetime import datetime, timedelta
from typing import Any

from app.core.ids import generate_claim_id, generate_zone_id
from app.db.mongo import now_utc
from app.models.claim import ClaimCreate
from app.repositories import attachment_repository, claim_repository, outbox_repository

SLA_WINDOWS = {
    "high": timedelta(hours=24),
    "medium": timedelta(hours=72),
    "low": timedelta(hours=120),
}


def _build_logistics(payload: ClaimCreate) -> dict[str, Any] | None:
    if not payload.logistics:
        return None

    logistics = payload.logistics
    carrier = logistics.carrier.model_dump() if logistics.carrier else None

    zone = logistics.zone.model_dump() if logistics.zone else None
    if zone and not zone.get("zone_id"):
        zone["zone_id"] = generate_zone_id(zone["name"])
    elif not zone and carrier and logistics.carrier.zone:
        zone_name = logistics.carrier.zone
        zone = {"zone_id": generate_zone_id(zone_name), "name": zone_name, "region": None}

    return {
        "carrier": carrier,
        "zone": zone,
        "promised_date": logistics.promised_date,
        "tracking_code": logistics.tracking_code,
    }


def _build_sla(priority: str, now: datetime) -> dict[str, Any]:
    return {"due_at": now + SLA_WINDOWS[priority], "breached": False}


def _build_claim_document(
    claim_id: str, payload: ClaimCreate, now: datetime, evidence_summary: dict[str, Any]
) -> dict[str, Any]:
    return {
        "_id": claim_id,
        "claim_id": claim_id,
        "claim_type": payload.claim_type,
        "channel": payload.channel,
        "priority": payload.priority,
        "current_status": "created",
        "created_at": now,
        "updated_at": now,
        "customer": payload.customer.model_dump(),
        "order": payload.order.model_dump(),
        "product": payload.product.model_dump(),
        "seller": payload.seller.model_dump(),
        "logistics": _build_logistics(payload),
        "details": dict(payload.details),
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
        "sla": _build_sla(payload.priority, now),
        "graph_sync_status": "pending_sync",
    }


def enrich_sla(claim: dict[str, Any]) -> dict[str, Any]:
    """
    Recalcula sla.breached al momento de leer el reclamo, en vez de dejarlo
    congelado en el valor que tenia al crearse. Para reclamos abiertos se
    compara contra el momento actual; para reclamos cerrados, contra la
    ultima actualizacion (aproximacion razonable a cuando se resolvio).
    """
    sla = claim.get("sla") or {}
    due_at = sla.get("due_at")
    if not due_at:
        return claim

    is_closed = claim["current_status"] in ("resolved", "closed", "rejected")
    reference_time = claim["updated_at"] if is_closed else now_utc()
    return {**claim, "sla": {**sla, "breached": reference_time > due_at}}


def create_claim(payload: ClaimCreate) -> dict[str, Any]:
    now = now_utc()
    claim_id = generate_claim_id()

    evidence_summary = attachment_repository.insert_attachments(
        claim_id, [item.model_dump() for item in payload.evidence], now
    )

    claim = _build_claim_document(claim_id, payload, now, evidence_summary)
    claim_repository.insert_claim(claim)

    logistics = claim.get("logistics") or {}
    outbox_repository.create_event(
        "ClaimCreated",
        claim_id,
        {
            "claim_id": claim_id,
            "customer_id": claim["customer"]["customer_id"],
            "product_id": claim["product"]["product_id"],
            "seller_id": claim["seller"]["seller_id"],
            "carrier_id": (logistics.get("carrier") or {}).get("carrier_id"),
            "zone_id": (logistics.get("zone") or {}).get("zone_id"),
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
