import asyncio
import logging
from typing import Any

from app.core.config import OUTBOX_BATCH_SIZE, OUTBOX_POLL_INTERVAL_SECONDS
from app.repositories import (
    claim_repository,
    customer_repository,
    graph_repository,
    notification_repository,
    outbox_repository,
    product_repository,
    seller_repository,
)

logger = logging.getLogger("outbox_worker")


def _dispatch(event: dict[str, Any]) -> None:
    event_type = event["event_type"]
    claim_id = event["payload"]["claim_id"]

    if event_type == "ClaimCreated":
        claim = claim_repository.find_claim(claim_id)
        if claim is None:
            return
        customer_repository.upsert_customer_summary(claim)
        product_repository.upsert_product_summary(claim)
        seller_repository.upsert_seller_summary(claim)
        graph_repository.sync_claim_graph(claim)
        notification_repository.create_notification(claim_id, "email", "ClaimCreated")
        claim_repository.set_graph_sync_status(claim_id, "synced")

    elif event_type == "ClaimStatusChanged":
        graph_repository.update_claim_status(claim_id, event["payload"]["current_status"])
        notification_repository.create_notification(claim_id, "email", "ClaimStatusChanged")

    else:
        logger.warning("Tipo de evento outbox desconocido: %s", event_type)


def _process_pending_batch() -> None:
    for event in outbox_repository.fetch_pending(limit=OUTBOX_BATCH_SIZE):
        try:
            _dispatch(event)
            outbox_repository.mark_processed(event["event_id"])
        except Exception as error:
            logger.warning("Error procesando evento outbox %s: %s", event["event_id"], error)
            outbox_repository.mark_failed(event["event_id"], str(error), event["retry_count"])


async def outbox_worker_loop() -> None:
    """
    Corre en background durante toda la vida del proceso FastAPI. El trabajo de
    Mongo/Neo4j es sincrono (pymongo/neo4j-driver), por eso se delega a un hilo
    con asyncio.to_thread para no bloquear el event loop de las peticiones HTTP.
    """
    while True:
        await asyncio.to_thread(_process_pending_batch)
        await asyncio.sleep(OUTBOX_POLL_INTERVAL_SECONDS)
