from typing import Any

from app.db.mongo import get_collection


def insert_claim(claim: dict[str, Any]) -> None:
    get_collection("claims").insert_one(claim)


def claim_exists(claim_id: str) -> bool:
    return get_collection("claims").find_one({"claim_id": claim_id}, {"_id": 1}) is not None


def find_claim(claim_id: str) -> dict[str, Any] | None:
    return get_collection("claims").find_one({"claim_id": claim_id})


def search_claims(query: dict[str, Any], limit: int):
    return get_collection("claims").find(query).sort("created_at", -1).limit(limit)


def count_claims(query: dict[str, Any]) -> int:
    return get_collection("claims").count_documents(query)


def push_status_history(claim_id: str, current_status: str, event: dict[str, Any]) -> int:
    result = get_collection("claims").update_one(
        {"claim_id": claim_id},
        {
            "$set": {"current_status": current_status, "updated_at": event["event_at"]},
            "$push": {"status_history": event},
        },
    )
    return result.matched_count


def set_graph_sync_status(claim_id: str, status: str) -> None:
    get_collection("claims").update_one({"claim_id": claim_id}, {"$set": {"graph_sync_status": status}})
