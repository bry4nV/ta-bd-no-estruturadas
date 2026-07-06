from typing import Any

from app.db.mongo import get_collection, now_utc


def upsert_customer_summary(claim: dict[str, Any]) -> None:
    customer = claim["customer"]
    summary = {
        "claim_id": claim["claim_id"],
        "claim_type": claim["claim_type"],
        "current_status": claim["current_status"],
        "created_at": claim["created_at"],
    }
    get_collection("customers").update_one(
        {"customer_id": customer["customer_id"]},
        {
            "$setOnInsert": {
                "_id": customer["customer_id"],
                "customer_id": customer["customer_id"],
                "email": customer.get("email"),
                "created_at": now_utc(),
            },
            "$set": {
                "name": customer.get("name"),
                "updated_at": now_utc(),
                "claim_summary.last_claim_at": claim["created_at"],
            },
            "$inc": {
                "claim_summary.total_claims": 1,
                "claim_summary.open_claims": 1,
            },
            "$push": {
                "recent_claims": {
                    "$each": [summary],
                    "$slice": -5,
                }
            },
        },
        upsert=True,
    )
