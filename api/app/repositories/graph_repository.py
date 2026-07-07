from typing import Any

from app.core.ids import generate_zone_id
from app.db.neo4j import driver


def sync_claim_graph(claim: dict[str, Any]) -> None:
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
        "zone_region": zone.get("region"),
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
    SET z.name = $zone_name,
        z.region = $zone_region

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
     collect(DISTINCT coalesce(e.product_id, e.seller_id, e.carrier_id, e.zone_id, e.customer_id)) AS entities,
     collect(DISTINCT coalesce(e.name, e.product_id, e.seller_id, e.carrier_id, e.zone_id, e.customer_id)) AS entity_labels
RETURN other.claim_id AS claim_id,
       other.claim_type AS claim_type,
       other.current_status AS current_status,
       2 AS hops,
       entity_types AS entity_types,
       entities AS shared_entities,
       entity_labels AS entity_labels
"""

# bridge_count = cantidad de reclamos-puente distintos que conectan a ambos
# reclamos en la distancia minima encontrada (puede haber varios caminos mas
# cortos, cada uno con su propio intermedio).
_TRANSITIVE_RELATED_QUERY_TEMPLATE = """
MATCH path = (r:Claim {{claim_id: $claim_id}})-[*4..{max_hops}]-(other:Claim)
WHERE other.claim_id <> $claim_id AND NOT other.claim_id IN $exclude_ids
WITH other, path, length(path) AS hops
WITH other, min(hops) AS hops, collect(path) AS paths
WITH other, hops, [p IN paths WHERE length(p) = hops] AS shortest_paths
WITH other, hops, shortest_paths[0] AS example_path, shortest_paths
UNWIND shortest_paths AS sp
UNWIND [n IN nodes(sp) WHERE n:Claim AND n.claim_id <> $claim_id AND n.claim_id <> other.claim_id | n.claim_id] AS bridge_id
WITH other, hops, example_path, collect(DISTINCT bridge_id) AS bridge_ids
WITH other, hops, size(bridge_ids) AS bridge_count,
     [n IN nodes(example_path) WHERE NOT n:Claim] AS chain,
     [n IN nodes(example_path) |
        CASE WHEN n:Claim
          THEN {{kind: 'Claim', id: n.claim_id, label: n.claim_id, claim_type: n.claim_type}}
          ELSE {{kind: labels(n)[0],
                 id: coalesce(n.customer_id, n.product_id, n.seller_id, n.carrier_id, n.zone_id),
                 label: coalesce(n.name, n.customer_id, n.product_id, n.seller_id, n.carrier_id, n.zone_id),
                 claim_type: null}}
        END
     ] AS path_nodes
RETURN other.claim_id AS claim_id,
       other.claim_type AS claim_type,
       other.current_status AS current_status,
       hops AS hops,
       bridge_count AS bridge_count,
       [n IN chain | labels(n)[0]] AS entity_types,
       [n IN chain | coalesce(n.name, n.customer_id, n.product_id, n.seller_id, n.carrier_id, n.zone_id)] AS shared_entities,
       path_nodes AS path_nodes
"""


_ENTITY_LABEL_ES = {
    "Customer": "cliente",
    "Product": "producto",
    "Seller": "vendedor",
    "Carrier": "operador logistico",
    "Zone": "zona",
}


def _build_motivo(entity_types: list[str], hops: int, bridge_count: int = 1) -> str:
    labels = [_ENTITY_LABEL_ES.get(t, t.lower()) for t in entity_types] or ["una entidad"]
    compartidas = " y ".join(labels)
    if hops == 2:
        return f"Comparte {compartidas} directamente"
    intermedios = (hops - 2) // 2
    if hops == 4 and bridge_count > 1:
        return f"Conectado via {compartidas}, a traves de {bridge_count} reclamos intermedios distintos"
    return f"Conectado via {compartidas}, a traves de {intermedios} reclamo(s) intermedio(s)"


def _score_direct(shared_entities: list[str]) -> float:
    return round(1.0 + (len(shared_entities) - 1) * 0.05, 2)


def _score_transitive(hops: int, bridge_count: int) -> float:
    # grado = hops/2 (1=directo excluido aqui, 2=un intermedio, ...); a mayor
    # grado, menor peso. Solo en grado 2 se afina con bridge_count.
    grado = hops // 2
    base = round(1.0 / grado, 2)
    if grado == 2:
        return round(base + (bridge_count - 1) * 0.05, 2)
    return base


def find_related_claims(claim_id: str, max_hops: int = 4, limit: int = 10):
    """
    Relaciones directas (hops=2) mas transitivas (hops>=4) hasta max_hops.
    Dos queries separadas para no perder el conteo completo de entidades
    compartidas en el caso directo.
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

    for row in direct:
        entity_labels = row.pop("entity_labels")
        row["score"] = _score_direct(row["shared_entities"])
        row["motivo"] = _build_motivo(row["entity_types"], row["hops"])
        origin_node = {"kind": "Claim", "id": claim_id, "label": claim_id, "claim_type": None}
        other_node = {"kind": "Claim", "id": row["claim_id"], "label": row["claim_id"], "claim_type": row["claim_type"]}
        row["paths"] = [
            [origin_node, {"kind": entity_type, "id": entity_id, "label": entity_label, "claim_type": None}, other_node]
            for entity_type, entity_id, entity_label in zip(row["entity_types"], row["shared_entities"], entity_labels)
        ]

    for row in transitive:
        bridge_count = row.pop("bridge_count")
        path_nodes = row.pop("path_nodes")
        row["score"] = _score_transitive(row["hops"], bridge_count)
        row["motivo"] = _build_motivo(row["entity_types"], row["hops"], bridge_count)
        row["paths"] = [path_nodes]

    combined = direct + transitive
    combined.sort(key=lambda row: -row["score"])
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
