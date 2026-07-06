import time

from neo4j import GraphDatabase

from app.core.config import NEO4J_PASSWORD, NEO4J_URI, NEO4J_USER

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def wait_for_neo4j(max_retries: int = 20, delay_seconds: int = 3) -> None:
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            with driver.session() as session:
                session.run("RETURN 1 AS ok").single()
            print("Neo4j conectado correctamente.")
            return
        except Exception as error:
            last_error = error
            print(f"Neo4j no disponible. Reintento {attempt}/{max_retries}...")
            time.sleep(delay_seconds)
    raise RuntimeError(f"No se pudo conectar a Neo4j: {last_error}")


def close_neo4j_driver():
    driver.close()


def create_constraints():
    statements = [
        "CREATE CONSTRAINT claim_id_unique IF NOT EXISTS FOR (c:Claim) REQUIRE c.claim_id IS UNIQUE",
        "CREATE CONSTRAINT customer_id_unique IF NOT EXISTS FOR (c:Customer) REQUIRE c.customer_id IS UNIQUE",
        "CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.product_id IS UNIQUE",
        "CREATE CONSTRAINT seller_id_unique IF NOT EXISTS FOR (s:Seller) REQUIRE s.seller_id IS UNIQUE",
        "CREATE CONSTRAINT carrier_id_unique IF NOT EXISTS FOR (c:Carrier) REQUIRE c.carrier_id IS UNIQUE",
        "CREATE CONSTRAINT zone_id_unique IF NOT EXISTS FOR (z:Zone) REQUIRE z.zone_id IS UNIQUE",
        "CREATE INDEX claim_type_created_at IF NOT EXISTS FOR (c:Claim) ON (c.claim_type, c.created_at)",
        "CREATE INDEX claim_status IF NOT EXISTS FOR (c:Claim) ON (c.current_status)",
    ]
    with driver.session() as session:
        for statement in statements:
            session.run(statement)
