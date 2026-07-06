from app.core.ids import generate_ulid_id
from app.db.mongo import get_collection, now_utc


def create_notification(claim_id: str, channel: str, event_type: str) -> None:
    notification_id = generate_ulid_id("NTF")
    get_collection("notifications").insert_one(
        {
            "_id": notification_id,
            "notification_id": notification_id,
            "claim_id": claim_id,
            "channel": channel,
            "event_type": event_type,
            "status": "simulated",
            "created_at": now_utc(),
        }
    )
