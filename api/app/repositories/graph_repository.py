from typing import Any

from app.core.ids import generate_zone_id
from app.db.neo4j import driver


def sync_claim_graph(claim: dict[str, Any]) -> None:
    """
    Proyecta en Neo4j solo las entidades necesarias para las consultas previstas.
    Order no se modela como nodo; sus datos quedan como propiedades del nodo Claim.
    """
    logistics = claim.get("logistics") or {}
    carrier = logistics.get("carrier") or {}
    zone = logistics.get("zone") or {}
    zone_name = zone.get("name") or carrier.get("zone") or "Sin zona"
    zone_id = zone.get("zone_id") or generate_zone_id(zone_name)

    params = {
        "claim_id": claim["claim_id"],
        "claim_type": claim["claim_type"],
        "current_status": claim["current_status"],
        "priority": claim["priority"],
        "created_at": claim["created_at"].isoformat(),
        "order_id": (claim.get("order") or {}).get("order_id"),
        "purchase_date": (claim.get("order") or {}).get("purchase_date"),
        "amount": (claim.get("order") or {}).get("amount"),
        "customer_id": claim["customer"]["customer_id"],
        "customer_name": claim["customer"].get("name"),
        "product_id": claim["product"]["product_id"],
        "product_name": claim["product"].get("name"),
        "product_category": claim["product"].get("category", "Sin categoria"),
        "seller_id": claim["seller"]["seller_id"],
        "seller_name": claim["seller"].get("name"),
        "carrier_id": carrier.get("carrier_id", "SIN_CARRIER"),
        "carrier_name": carrier.get("name", "Sin operador"),
        "tracking_code": logistics.get("tracking_code"),
        "zone_id": zone_id,
        "zone_name": zone_name,
    }

    query = """
    MERGE (c:Claim {claim_id: $claim_id})
    SET c.claim_type = $claim_type,
        c.current_status = $current_status,
        c.priority = $priority,
        c.created_at = datetime($created_at),
        c.order_id = $order_id,
        c.purchase_date = $purchase_date,
        c.amount = $amount

    MERGE (cu:Customer {customer_id: $customer_id})
    SET cu.name = $customer_name

    MERGE (p:Product {product_id: $product_id})
    SET p.name = $product_name,
        p.category = $product_category

    MERGE (s:Seller {seller_id: $seller_id})
    SET s.name = $seller_name

    MERGE (ca:Carrier {carrier_id: $carrier_id})
    SET ca.name = $carrier_name

    MERGE (z:Zone {zone_id: $zone_id})
    SET z.name = $zone_name

    MERGE (c)-[rb:REGISTERED_BY]->(cu)
    SET rb.created_at = datetime($created_at)
    MERGE (c)-[ap:ABOUT_PRODUCT]->(p)
    SET ap.amount = $amount
    MERGE (p)-[:SOLD_BY]->(s)
    MERGE (c)-[hb:HANDLED_BY]->(ca)
    SET hb.tracking_code = $tracking_code
    MERGE (c)-[:OCCURS_IN_ZONE]->(z)
    """

    with driver.session() as session:
        session.run(query, **params)


def update_claim_status(claim_id: str, current_status: str) -> None:
    with driver.session() as session:
        session.run(
            "MATCH (c:Claim {claim_id: $claim_id}) SET c.current_status = $current_status",
            claim_id=claim_id,
            current_status=current_status,
        )


_DIRECT_RELATED_QUERY = """
MATCH (r:Claim {claim_id: $claim_id})-[]-(e)-[]-(other:Claim)
WHERE other.claim_id <> r.claim_id
WITH other,
     collect(DISTINCT labels(e)[0]) AS entity_types,
     collect(DISTINCT coalesce(e.product_id, e.seller_id, e.carrier_id, e.zone_id, e.customer_id)) AS entities
RETURN other.claim_id AS claim_id,
       other.claim_type AS claim_type,
       other.current_status AS current_status,
       2 AS hops,
       entity_types AS entity_types,
       entities AS shared_entities,
       size(entities) * 0.25 AS score
"""

_TRANSITIVE_RELATED_QUERY_TEMPLATE = """
MATCH path = (r:Claim {{claim_id: $claim_id}})-[*4..{max_hops}]-(other:Claim)
WHERE other.claim_id <> $claim_id AND NOT other.claim_id IN $exclude_ids
WITH other, path, length(path) AS hops
ORDER BY hops ASC
WITH other, min(hops) AS hops, collect(path)[0] AS shortest_path
WITH other, hops, [n IN nodes(shortest_path) WHERE NOT n:Claim] AS chain
RETURN other.claim_id AS claim_id,
       other.claim_type AS claim_type,
       other.current_status AS current_status,
       hops AS hops,
       [n IN chain | labels(n)[0]] AS entity_types,
       [n IN chain | coalesce(n.name, n.customer_id, n.product_id, n.seller_id, n.carrier_id, n.zone_id)] AS shared_entities,
       round(1.0 / (hops / 2.0), 2) AS score
"""


_ENTITY_LABEL_ES = {
    "Customer": "cliente",
    "Product": "producto",
    "Seller": "vendedor",
    "Carrier": "operador logistico",
    "Zone": "zona",
}


def _build_motivo(entity_types: list[str], hops: int) -> str:
    labels = [_ENTITY_LABEL_ES.get(t, t.lower()) for t in entity_types] or ["una entidad"]
    compartidas = " y ".join(labels)
    if hops == 2:
        return f"Comparte {compartidas} directamente"
    intermedios = (hops - 2) // 2
    return f"Conectado via {compartidas}, a traves de {intermedios} reclamo(s) intermedio(s)"


def find_related_claims(claim_id: str, max_hops: int = 4, limit: int = 10):
    """
    Relaciones directas (hops=2, todas las entidades compartidas contadas) mas
    relaciones transitivas (hops>=4, a traves de una cadena de reclamos
    intermedios) hasta max_hops. Dos queries separadas en vez de una unica con
    camino de longitud variable, para no perder el conteo completo de
    entidades compartidas en el caso directo.
    """
    with driver.session() as session:
        direct = [dict(record) for record in session.run(_DIRECT_RELATED_QUERY, claim_id=claim_id)]
        direct_ids = [row["claim_id"] for row in direct]

        transitive = []
        if max_hops >= 4:
            query = _TRANSITIVE_RELATED_QUERY_TEMPLATE.format(max_hops=max_hops)
            transitive = [
                dict(record)
                for record in session.run(query, claim_id=claim_id, exclude_ids=direct_ids)
            ]

    combined = direct + transitive
    for row in combined:
        row["motivo"] = _build_motivo(row["entity_types"], row["hops"])

    combined.sort(key=lambda row: (-row["score"], row["hops"]))
    return combined[:limit]


def recurring_entities(limit: int = 10):
    query = """
    MATCH (c:Claim)-[]-(e)
    WHERE e:Customer OR e:Product OR e:Seller OR e:Carrier OR e:Zone
    WITH labels(e)[0] AS entity_type,
         coalesce(e.customer_id, e.product_id, e.seller_id, e.carrier_id, e.zone_id) AS entity_id,
         coalesce(e.name, 'Sin nombre') AS name,
         count(DISTINCT c) AS total_claims
    WHERE total_claims >= 1
    RETURN entity_type, entity_id, name, total_claims
    ORDER BY total_claims DESC, entity_type
    LIMIT $limit
    """
    with driver.session() as session:
        result = session.run(query, limit=limit)
        return [dict(record) for record in result]
