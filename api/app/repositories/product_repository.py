from typing import Any

from app.db.mongo import get_collection, now_utc


def upsert_product_summary(claim: dict[str, Any]) -> None:
    product = claim["product"]
    month = claim["created_at"].strftime("%Y-%m")
    collection = get_collection("products")
    collection.update_one(
        {"product_id": product["product_id"]},
        {
            "$setOnInsert": {
                "_id": product["product_id"],
                "product_id": product["product_id"],
                "created_at": now_utc(),
            },
            "$set": {
                "name": product.get("name"),
                "category": product.get("category", "Sin categoria"),
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
        {"product_id": product["product_id"], "monthly_stats.month": month},
        {"$inc": {"monthly_stats.$.claims_created": 1}},
    )
    collection.update_one(
        {"product_id": product["product_id"], "monthly_stats.month": {"$ne": month}},
        {"$push": {"monthly_stats": {"month": month, "claims_created": 1}}},
    )
