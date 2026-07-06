from fastapi import APIRouter, Query

from app.db.mongo import get_collection, serialize_many
from app.repositories.graph_repository import recurring_entities

router = APIRouter(prefix="/api/v1/analytics", tags=["03. Analisis"])


def _aggregate(collection_name: str, pipeline: list[dict]):
    return list(get_collection(collection_name).aggregate(pipeline))


@router.get(
    "/operational-summary",
    summary="Resumen operativo de reclamos",
    description="Devuelve indicadores generales desde MongoDB y entidades recurrentes desde Neo4j para demostrar la parte analitica.",
)
def operational_summary():
    claims = get_collection("claims")
    total_claims = claims.count_documents({})

    by_status = _aggregate("claims", [
        {"$group": {"_id": "$current_status", "total": {"$sum": 1}}},
        {"$project": {"_id": 0, "current_status": "$_id", "total": 1}},
        {"$sort": {"total": -1}},
    ])
    by_claim_type = _aggregate("claims", [
        {"$group": {"_id": "$claim_type", "total": {"$sum": 1}}},
        {"$project": {"_id": 0, "claim_type": "$_id", "total": 1}},
        {"$sort": {"total": -1}},
    ])
    by_channel = _aggregate("claims", [
        {"$group": {"_id": "$channel", "total": {"$sum": 1}}},
        {"$project": {"_id": 0, "channel": "$_id", "total": 1}},
        {"$sort": {"total": -1}},
    ])
    top_products = _aggregate("claims", [
        {"$group": {"_id": {"product_id": "$product.product_id", "name": "$product.name"}, "total": {"$sum": 1}}},
        {"$project": {"_id": 0, "product_id": "$_id.product_id", "name": "$_id.name", "total": 1}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ])
    top_sellers = _aggregate("claims", [
        {"$group": {"_id": {"seller_id": "$seller.seller_id", "name": "$seller.name"}, "total": {"$sum": 1}}},
        {"$project": {"_id": 0, "seller_id": "$_id.seller_id", "name": "$_id.name", "total": 1}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ])

    return {
        "total_claims": total_claims,
        "by_status": by_status,
        "by_claim_type": by_claim_type,
        "by_channel": by_channel,
        "top_products": top_products,
        "top_sellers": top_sellers,
        "recurring_entities_neo4j": recurring_entities(limit=10),
    }


@router.get("/customers-summary", summary="Clientes con resumen documental")
def customers_summary(limit: int = Query(10, ge=1, le=50)):
    docs = get_collection("customers").find().sort("claim_summary.total_claims", -1).limit(limit)
    return {"customers": serialize_many(docs)}


@router.get("/products-at-risk", summary="Productos con mayor recurrencia de reclamos")
def products_at_risk(limit: int = Query(10, ge=1, le=50)):
    docs = get_collection("products").find().sort("claim_summary.total_claims", -1).limit(limit)
    return {"products": serialize_many(docs)}


@router.get("/sellers-at-risk", summary="Vendedores con mayor concentracion de reclamos")
def sellers_at_risk(limit: int = Query(10, ge=1, le=50)):
    docs = get_collection("sellers").find().sort("claim_summary.total_claims", -1).limit(limit)
    return {"sellers": serialize_many(docs)}


@router.get(
    "/recurring-incidents",
    summary="Entidades recurrentes en el grafo",
    description="Consulta Neo4j para listar clientes, productos, vendedores, operadores o zonas con mayor concentracion de reclamos.",
)
def recurring_incidents(limit: int = Query(10, ge=1, le=50)):
    return {"entities": recurring_entities(limit=limit)}


@router.get("/outbox", summary="Eventos pendientes de sincronizacion")
def outbox_events(status: str | None = None, limit: int = Query(20, ge=1, le=100)):
    query = {"status": status} if status else {}
    docs = get_collection("outbox_events").find(query).sort("created_at", -1).limit(limit)
    return {"events": serialize_many(docs)}
