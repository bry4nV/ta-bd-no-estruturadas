from typing import Any

from app.core.config import OUTBOX_MAX_RETRIES
from app.core.ids import generate_ulid_id
from app.db.mongo import get_collection, now_utc


def create_event(event_type: str, aggregate_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    event_id = generate_ulid_id("EVT")
    event = {
        "_id": event_id,
        "event_id": event_id,
        "event_type": event_type,
        "aggregate_type": "Claim",
        "aggregate_id": aggregate_id,
        "payload": payload,
        "status": "PENDING",
        "created_at": now_utc(),
        "processed_at": None,
        "retry_count": 0,
        "last_error": None,
    }
    get_collection("outbox_events").insert_one(event)
    return event


def fetch_pending(limit: int) -> list[dict[str, Any]]:
    return list(get_collection("outbox_events").find({"status": "PENDING"}).sort("created_at", 1).limit(limit))


def mark_processed(event_id: str) -> None:
    get_collection("outbox_events").update_one(
        {"event_id": event_id},
        {"$set": {"status": "PROCESSED", "processed_at": now_utc()}},
    )


def mark_failed(event_id: str, error: str, retry_count: int) -> None:
    next_status = "FAILED" if retry_count + 1 >= OUTBOX_MAX_RETRIES else "PENDING"
    get_collection("outbox_events").update_one(
        {"event_id": event_id},
        {
            "$set": {"status": next_status, "last_error": error, "updated_at": now_utc()},
            "$inc": {"retry_count": 1},
        },
    )
