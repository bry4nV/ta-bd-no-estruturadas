CREATE CONSTRAINT claim_id_unique IF NOT EXISTS
FOR (c:Claim) REQUIRE c.claim_id IS UNIQUE;

CREATE CONSTRAINT customer_id_unique IF NOT EXISTS
FOR (c:Customer) REQUIRE c.customer_id IS UNIQUE;

CREATE CONSTRAINT product_id_unique IF NOT EXISTS
FOR (p:Product) REQUIRE p.product_id IS UNIQUE;

CREATE CONSTRAINT seller_id_unique IF NOT EXISTS
FOR (s:Seller) REQUIRE s.seller_id IS UNIQUE;

CREATE CONSTRAINT carrier_id_unique IF NOT EXISTS
FOR (c:Carrier) REQUIRE c.carrier_id IS UNIQUE;

CREATE CONSTRAINT zone_id_unique IF NOT EXISTS
FOR (z:Zone) REQUIRE z.zone_id IS UNIQUE;

// Entidades compartidas entre reclamos.
MERGE (cuJuan:Customer {customer_id: "CUS-001"}) SET cuJuan.name = "Juan Perez";
MERGE (cuMaria:Customer {customer_id: "CUS-002"}) SET cuMaria.name = "Maria Lopez";
MERGE (cuCarlos:Customer {customer_id: "CUS-003"}) SET cuCarlos.name = "Carlos Ramirez";

MERGE (prAudifonos:Product {product_id: "PRD-501"}) SET prAudifonos.name = "Audifonos Bluetooth", prAudifonos.category = "Tecnologia";
MERGE (prZapatillas:Product {product_id: "PRD-502"}) SET prZapatillas.name = "Zapatillas Running", prZapatillas.category = "Calzado";

MERGE (seTech:Seller {seller_id: "SEL-010"}) SET seTech.name = "Tech Store Peru";
MERGE (seDeportes:Seller {seller_id: "SEL-020"}) SET seDeportes.name = "Deportes Lima";

MERGE (caRapido:Carrier {carrier_id: "CAR-001"}) SET caRapido.name = "Rapido Express";
MERGE (caOlva:Carrier {carrier_id: "CAR-002"}) SET caOlva.name = "Olva Courier";
MERGE (caSinOperador:Carrier {carrier_id: "SIN_CARRIER"}) SET caSinOperador.name = "Sin operador";

MERGE (znNorte:Zone {zone_id: "ZON-lima-norte"}) SET znNorte.name = "Lima Norte", znNorte.region = "Lima";
MERGE (znSur:Zone {zone_id: "ZON-lima-sur"}) SET znSur.name = "Lima Sur", znSur.region = "Lima";
MERGE (znSinZona:Zone {zone_id: "ZON-sin-zona"}) SET znSinZona.name = "Sin zona";

MATCH (p:Product {product_id: "PRD-501"}), (s:Seller {seller_id: "SEL-010"}) MERGE (p)-[:SOLD_BY]->(s);
MATCH (p:Product {product_id: "PRD-502"}), (s:Seller {seller_id: "SEL-020"}) MERGE (p)-[:SOLD_BY]->(s);

// Reclamo 1: late_delivery, Juan Perez, Audifonos, Tech Store, Rapido Express, Lima Norte.
MERGE (c1:Claim {claim_id: "CLM-20260620-DEMOSEED01"})
SET c1.claim_type = "late_delivery", c1.current_status = "created", c1.priority = "high",
    c1.order_id = "ORD-1001", c1.purchase_date = "2026-06-20", c1.amount = 349.90;
MATCH (c1:Claim {claim_id: "CLM-20260620-DEMOSEED01"}), (cu:Customer {customer_id: "CUS-001"})
MERGE (c1)-[rb1:REGISTERED_BY]->(cu) SET rb1.created_at = datetime("2026-06-20T10:00:00");
MATCH (c1:Claim {claim_id: "CLM-20260620-DEMOSEED01"}), (p:Product {product_id: "PRD-501"})
MERGE (c1)-[ap1:ABOUT_PRODUCT]->(p) SET ap1.amount = 349.90;
MATCH (c1:Claim {claim_id: "CLM-20260620-DEMOSEED01"}), (ca:Carrier {carrier_id: "CAR-001"})
MERGE (c1)-[hb1:HANDLED_BY]->(ca) SET hb1.tracking_code = "TRK-10001";
MATCH (c1:Claim {claim_id: "CLM-20260620-DEMOSEED01"}), (z:Zone {zone_id: "ZON-lima-norte"}) MERGE (c1)-[:OCCURS_IN_ZONE]->(z);

// Reclamo 2: defective_product, Maria Lopez, mismos Audifonos/Tech Store/Rapido/Lima Norte (se relaciona con el 1).
MERGE (c2:Claim {claim_id: "CLM-20260621-DEMOSEED02"})
SET c2.claim_type = "defective_product", c2.current_status = "created", c2.priority = "medium",
    c2.order_id = "ORD-1010", c2.purchase_date = "2026-06-21", c2.amount = 349.90;
MATCH (c2:Claim {claim_id: "CLM-20260621-DEMOSEED02"}), (cu:Customer {customer_id: "CUS-002"})
MERGE (c2)-[rb2:REGISTERED_BY]->(cu) SET rb2.created_at = datetime("2026-06-21T10:00:00");
MATCH (c2:Claim {claim_id: "CLM-20260621-DEMOSEED02"}), (p:Product {product_id: "PRD-501"})
MERGE (c2)-[ap2:ABOUT_PRODUCT]->(p) SET ap2.amount = 349.90;
MATCH (c2:Claim {claim_id: "CLM-20260621-DEMOSEED02"}), (ca:Carrier {carrier_id: "CAR-001"})
MERGE (c2)-[hb2:HANDLED_BY]->(ca) SET hb2.tracking_code = "TRK-10002";
MATCH (c2:Claim {claim_id: "CLM-20260621-DEMOSEED02"}), (z:Zone {zone_id: "ZON-lima-norte"}) MERGE (c2)-[:OCCURS_IN_ZONE]->(z);

// Reclamo 3: incorrect_charge, Juan Perez (se relaciona con el 1 por cliente), Zapatillas/Deportes Lima/Olva/Lima Sur.
MERGE (c3:Claim {claim_id: "CLM-20260622-DEMOSEED03"})
SET c3.claim_type = "incorrect_charge", c3.current_status = "created", c3.priority = "high",
    c3.order_id = "ORD-2001", c3.purchase_date = "2026-06-22", c3.amount = 159.90;
MATCH (c3:Claim {claim_id: "CLM-20260622-DEMOSEED03"}), (cu:Customer {customer_id: "CUS-001"})
MERGE (c3)-[rb3:REGISTERED_BY]->(cu) SET rb3.created_at = datetime("2026-06-22T10:00:00");
MATCH (c3:Claim {claim_id: "CLM-20260622-DEMOSEED03"}), (p:Product {product_id: "PRD-502"})
MERGE (c3)-[ap3:ABOUT_PRODUCT]->(p) SET ap3.amount = 159.90;
MATCH (c3:Claim {claim_id: "CLM-20260622-DEMOSEED03"}), (ca:Carrier {carrier_id: "CAR-002"})
MERGE (c3)-[hb3:HANDLED_BY]->(ca);
MATCH (c3:Claim {claim_id: "CLM-20260622-DEMOSEED03"}), (z:Zone {zone_id: "ZON-lima-sur"}) MERGE (c3)-[:OCCURS_IN_ZONE]->(z);

// Reclamo 4: return_rejected, Carlos Ramirez, mismos Zapatillas/Deportes Lima/Olva/Lima Sur (se relaciona con el 3).
MERGE (c4:Claim {claim_id: "CLM-20260623-DEMOSEED04"})
SET c4.claim_type = "return_rejected", c4.current_status = "created", c4.priority = "medium",
    c4.order_id = "ORD-2010", c4.purchase_date = "2026-06-23", c4.amount = 179.90;
MATCH (c4:Claim {claim_id: "CLM-20260623-DEMOSEED04"}), (cu:Customer {customer_id: "CUS-003"})
MERGE (c4)-[rb4:REGISTERED_BY]->(cu) SET rb4.created_at = datetime("2026-06-23T10:00:00");
MATCH (c4:Claim {claim_id: "CLM-20260623-DEMOSEED04"}), (p:Product {product_id: "PRD-502"})
MERGE (c4)-[ap4:ABOUT_PRODUCT]->(p) SET ap4.amount = 179.90;
MATCH (c4:Claim {claim_id: "CLM-20260623-DEMOSEED04"}), (ca:Carrier {carrier_id: "CAR-002"})
MERGE (c4)-[hb4:HANDLED_BY]->(ca);
MATCH (c4:Claim {claim_id: "CLM-20260623-DEMOSEED04"}), (z:Zone {zone_id: "ZON-lima-sur"}) MERGE (c4)-[:OCCURS_IN_ZONE]->(z);

// Reclamo 5: customer_service, Maria Lopez, sin operador/zona asignados (caso de reclamo sin logistica).
MERGE (c5:Claim {claim_id: "CLM-20260624-DEMOSEED05"})
SET c5.claim_type = "customer_service", c5.current_status = "created", c5.priority = "low",
    c5.order_id = "ORD-1020", c5.purchase_date = "2026-06-24", c5.amount = 349.90;
MATCH (c5:Claim {claim_id: "CLM-20260624-DEMOSEED05"}), (cu:Customer {customer_id: "CUS-002"})
MERGE (c5)-[rb5:REGISTERED_BY]->(cu) SET rb5.created_at = datetime("2026-06-24T10:00:00");
MATCH (c5:Claim {claim_id: "CLM-20260624-DEMOSEED05"}), (p:Product {product_id: "PRD-501"})
MERGE (c5)-[ap5:ABOUT_PRODUCT]->(p) SET ap5.amount = 349.90;
MATCH (c5:Claim {claim_id: "CLM-20260624-DEMOSEED05"}), (ca:Carrier {carrier_id: "SIN_CARRIER"})
MERGE (c5)-[hb5:HANDLED_BY]->(ca);
MATCH (c5:Claim {claim_id: "CLM-20260624-DEMOSEED05"}), (z:Zone {zone_id: "ZON-sin-zona"}) MERGE (c5)-[:OCCURS_IN_ZONE]->(z);
