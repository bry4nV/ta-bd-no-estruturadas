from fastapi import APIRouter, Body, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError

from app.db.mongo import serialize_document, serialize_many
from app.models.claim import ClaimCreate, StatusUpdate
from app.models.claim_examples import CLAIM_EXAMPLES
from app.models.responses import ApiMessage, RelatedClaimsResponse
from app.repositories import attachment_repository, claim_repository, graph_repository
from app.services import claim_service

router = APIRouter(prefix="/api/v1/claims", tags=["02. Reclamos"])


@router.post(
    "",
    response_model=ApiMessage,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar reclamo postventa",
    description="Registra el reclamo en MongoDB, guarda la evidencia en `claim_attachments` y "
    "encola un evento `ClaimCreated` en el outbox para que un worker en background actualice "
    "los resumenes y proyecte el reclamo en Neo4j.",
)
def create_claim(payload: ClaimCreate = Body(..., openapi_examples=CLAIM_EXAMPLES)):
    try:
        claim = claim_service.create_claim(payload)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="El reclamo ya existe") from exc

    return ApiMessage(
        claim_id=claim["claim_id"],
        current_status=claim["current_status"],
        message="Reclamo registrado correctamente",
    )


@router.get(
    "",
    summary="Buscar reclamos",
    description="Busca reclamos en MongoDB por filtros operativos frecuentes: estado, tipo, cliente, producto o vendedor. Soporta paginacion con limit/offset.",
)
def search_claims(
    current_status: str | None = None,
    claim_type: str | None = None,
    customer_id: str | None = None,
    product_id: str | None = None,
    seller_id: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0, description="Cantidad de reclamos a saltar, para paginar"),
):
    query = {}
    if current_status:
        query["current_status"] = current_status
    if claim_type:
        query["claim_type"] = claim_type
    if customer_id:
        query["customer.customer_id"] = customer_id
    if product_id:
        query["product.product_id"] = product_id
    if seller_id:
        query["seller.seller_id"] = seller_id

    docs = [claim_service.enrich_sla(doc) for doc in claim_repository.search_claims(query, limit, offset)]
    return {
        "total_coincidencias": claim_repository.count_claims(query),
        "total_mostrado": len(docs),
        "offset": offset,
        "claims": serialize_many(docs),
    }


@router.get(
    "/{claim_id}",
    summary="Consultar detalle del reclamo",
    description="Consulta el documento completo del reclamo desde MongoDB, incluyendo snapshots, resumen de evidencia, historial y SLA (sla.breached se recalcula en cada consulta).",
)
def get_claim(claim_id: str):
    claim = claim_repository.find_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Reclamo no encontrado")
    return serialize_document(claim_service.enrich_sla(claim))


@router.get(
    "/{claim_id}/attachments",
    summary="Consultar evidencia completa del reclamo",
    description="Devuelve la metadata completa de cada evidencia (`type`, `url`, `description`, "
    "`uploaded_at`) desde `claim_attachments`, a diferencia de `evidence_summary` que va embebido "
    "y acotado en `claims`.",
)
def get_claim_attachments(claim_id: str):
    if not claim_repository.claim_exists(claim_id):
        raise HTTPException(status_code=404, detail="Reclamo no encontrado")
    docs = attachment_repository.find_attachments(claim_id)
    return {"claim_id": claim_id, "attachments": serialize_many(docs)}


@router.put(
    "/{claim_id}/status",
    response_model=ApiMessage,
    summary="Actualizar estado del reclamo",
    description="Actualiza el estado oficial del reclamo en MongoDB y registra trazabilidad en el historial. Genera un evento ClaimStatusChanged que el worker propaga a Neo4j.",
)
def update_claim_status(claim_id: str, payload: StatusUpdate):
    matched_count = claim_service.change_status(
        claim_id, payload.current_status, payload.comment, payload.actor_id
    )
    if matched_count == 0:
        raise HTTPException(status_code=404, detail="Reclamo no encontrado")

    return ApiMessage(
        claim_id=claim_id,
        current_status=payload.current_status,
        message="Estado actualizado correctamente",
    )


@router.get(
    "/{claim_id}/related",
    response_model=RelatedClaimsResponse,
    summary="Consultar reclamos relacionados",
    description="Consulta Neo4j (on-demand, no persistido) para encontrar reclamos relacionados "
    "por entidades compartidas: cliente, producto, vendedor, operador logistico o zona. Incluye "
    "relaciones directas (`hops=2`) y transitivas a traves de reclamos intermedios (`hops=4, 6, ...`) "
    "hasta `max_hops`. `score` decae con la distancia, `motivo` explica la relacion en texto, y "
    "`entity_types`/`shared_entities` muestran la cadena de entidades que conecta ambos reclamos.",
)
def get_related_claims(
    claim_id: str,
    max_hops: int = Query(4, ge=2, le=6, description="Profundidad maxima de la busqueda transitiva (2 = solo directas)"),
    limit: int = Query(10, ge=1, le=50),
):
    if not claim_repository.claim_exists(claim_id):
        raise HTTPException(status_code=404, detail="Reclamo no encontrado en MongoDB")

    related = graph_repository.find_related_claims(claim_id, max_hops=max_hops, limit=limit)
    return {"claim_id": claim_id, "related": related}
