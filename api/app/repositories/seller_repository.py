from typing import Any

from app.db.mongo import get_collection, now_utc


def upsert_seller_summary(claim: dict[str, Any]) -> None:
    seller = claim["seller"]
    month = claim["created_at"].strftime("%Y-%m")
    collection = get_collection("sellers")
    collection.update_one(
        {"seller_id": seller["seller_id"]},
        {
            "$setOnInsert": {
                "_id": seller["seller_id"],
                "seller_id": seller["seller_id"],
                "created_at": now_utc(),
            },
            "$set": {
                "name": seller.get("name"),
                "updated_at": now_utc(),
                "claim_summary.last_claim_at": claim["created_at"],
            },
            "$inc": {
                "claim_summary.total_claims": 1,
                "claim_summary.open_claims": 1,
            },
        },
        upsert=True,
    )
    collection.update_one(
        {"seller_id": seller["seller_id"], "monthly_stats.month": month},
        {"$inc": {"monthly_stats.$.claims_created": 1}},
    )
    collection.update_one(
        {"seller_id": seller["seller_id"], "monthly_stats.month": {"$ne": month}},
        {"$push": {"monthly_stats": {"month": month, "claims_created": 1}}},
    )
