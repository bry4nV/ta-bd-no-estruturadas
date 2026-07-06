from datetime import datetime
from typing import Any

from app.core.ids import generate_ulid_id
from app.db.mongo import get_collection


def insert_attachments(claim_id: str, evidence: list[dict[str, Any]], uploaded_at: datetime) -> dict[str, Any]:
    collection = get_collection("claim_attachments")
    types: list[str] = []
    for item in evidence:
        attachment_id = generate_ulid_id("ATT")
        collection.insert_one(
            {
                "_id": attachment_id,
                "attachment_id": attachment_id,
                "claim_id": claim_id,
                "type": item["type"],
                "url": item["url"],
                "description": item.get("description"),
                "uploaded_at": uploaded_at,
            }
        )
        types.append(item["type"])

    return {
        "count": len(evidence),
        "types": sorted(set(types)),
        "last_uploaded_at": uploaded_at if evidence else None,
    }
