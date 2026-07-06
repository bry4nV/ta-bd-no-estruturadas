import time
from datetime import datetime, timezone
from typing import Any

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import MONGO_DB, MONGO_URI

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tz_aware=True)


def get_database() -> Database:
    return client[MONGO_DB]


def get_collection(name: str):
    return get_database()[name]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize_document(document: dict[str, Any] | None):
    if document is None:
        return None
    doc = dict(document)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def serialize_many(documents):
    return [serialize_document(doc) for doc in documents]


def wait_for_mongo(max_retries: int = 20, delay_seconds: int = 3) -> None:
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            get_database().command("ping")
            print("MongoDB conectado correctamente.")
            return
        except Exception as error:
            last_error = error
            print(f"MongoDB no disponible. Reintento {attempt}/{max_retries}...")
            time.sleep(delay_seconds)
    raise RuntimeError(f"No se pudo conectar a MongoDB: {last_error}")


def ensure_indexes():
    db = get_database()

    db.claims.create_index("claim_id", unique=True)
    db.claims.create_index([("customer.customer_id", 1), ("created_at", -1)])
    db.claims.create_index([("current_status", 1), ("priority", 1), ("created_at", -1)])
    db.claims.create_index([("claim_type", 1), ("created_at", -1)])
    db.claims.create_index("order.order_id")
    db.claims.create_index([("product.product_id", 1), ("created_at", -1)])
    db.claims.create_index([("seller.seller_id", 1), ("created_at", -1)])
    db.claims.create_index([("logistics.carrier.carrier_id", 1), ("logistics.zone.name", 1), ("created_at", -1)])

    db.customers.create_index("customer_id", unique=True)
    db.products.create_index("product_id", unique=True)
    db.products.create_index([("monthly_stats.month", 1), ("category", 1)])
    db.sellers.create_index("seller_id", unique=True)
    db.sellers.create_index("monthly_stats.month")

    db.outbox_events.create_index("event_id", unique=True)
    db.outbox_events.create_index([("status", 1), ("created_at", 1)])
    db.notifications.create_index([("claim_id", 1), ("created_at", -1)])
    db.claim_attachments.create_index("attachment_id", unique=True)
    db.claim_attachments.create_index([("claim_id", 1), ("uploaded_at", -1)])
