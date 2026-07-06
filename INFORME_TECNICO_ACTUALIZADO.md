# Informe técnico actualizado — Sistema NoSQL de Reclamos Postventa

> Este documento sigue la misma estructura y numeración del informe original (secciones 4.3 a 6.5), actualizada para reflejar exactamente lo implementado en el código a la fecha. Donde el diseño evolucionó respecto al planteamiento inicial, se indica el motivo.

**Convención de nombres**: colecciones, campos de documentos y valores de enumeración (`claim_type`, `channel`, `current_status`, `priority`) usan `snake_case` en minúscula en toda la API (ej. `"late_delivery"`, `"high"`), siguiendo la convención estándar de APIs REST/JSON modernas (Stripe, GitHub, Twilio), donde el valor en la red no imita la convención `MAYÚSCULA_CON_GUION` propia de constantes de enum en Java/C#.

---

## 4.3.2. Documento JSON principal: `claims`

El documento `claims` resume el caso de reclamo como agregado principal. `customer`, `order`, `product` y `seller` se embeben como snapshots para evitar consultas adicionales al abrir el caso. `logistics` agrupa todo lo relacionado a la entrega (operador, zona, fecha prometida, código de seguimiento) en un solo sub-documento, y puede ser `null` cuando el reclamo no tiene componente logístico (ej. `customer_service`). `priority` es un campo propio del reclamo (no vive dentro de `details`), porque se usa para indexar y para calcular el SLA.

```json
{
  "_id": "CLM-20260621-01J1P9Y7K8M2A6",
  "claim_id": "CLM-20260621-01J1P9Y7K8M2A6",
  "claim_type": "late_delivery",
  "channel": "mobile_app",
  "priority": "high",
  "current_status": "in_review",
  "created_at": "2026-06-21T10:15:00Z",
  "updated_at": "2026-06-21T10:15:00Z",
  "customer": {
    "customer_id": "CUS-739201",
    "name": "Cliente Ejemplo",
    "email": "cliente@mail.com"
  },
  "order": {
    "order_id": "ORD-20260618-55291",
    "purchase_date": "2026-06-18",
    "amount": 349.90
  },
  "product": { "product_id": "PRD-SKU-88991", "name": "Audifonos inalambricos", "category": "Tecnologia" },
  "seller": { "seller_id": "SEL-1021", "name": "Tech Store Peru" },
  "logistics": {
    "carrier": { "carrier_id": "CAR-05", "name": "Rapido Express" },
    "zone": { "zone_id": "ZON-lima-norte", "name": "Lima Norte", "region": "Lima" },
    "promised_date": "2026-06-20",
    "tracking_code": "TRK-88991"
  },
  "details": { "description": "El pedido figura como entregado, pero no fue recibido." },
  "evidence_summary": { "count": 1, "types": ["image"], "last_uploaded_at": "2026-06-21T10:15:00Z" },
  "status_history": [
    { "current_status": "created", "actor_type": "customer", "actor_id": "CUS-739201", "comment": "Reclamo registrado", "event_at": "2026-06-21T10:15:00Z" }
  ],
  "sla": { "due_at": "2026-06-22T10:15:00Z", "breached": false },
  "graph_sync_status": "synced"
}
```

**Sobre `sla`**: `due_at` se calcula al crear el reclamo, según `priority` (`high` = 24h, `medium` = 72h, `low` = 120h desde `created_at`). `breached` **no se guarda fijo** — se recalcula en cada lectura (`GET /claims/{id}`, `GET /claims`): si el reclamo sigue abierto, se compara contra el momento actual; si ya se cerró, contra `updated_at` (aproximación a cuándo se resolvió). Esto evita que un reclamo abierto y vencido muestre `breached: false` solo porque nadie volvió a escribirlo.

**Sobre `graph_sync_status`**: arranca en `pending_sync` al crear el reclamo, y pasa a `synced` cuando el worker asíncrono de outbox termina de proyectarlo en Neo4j (ver sección 4.3.5).

## 4.3.3. Documento resumen: `customers`

No reemplaza el snapshot embebido en `claims`; es una vista de lectura rápida, actualizada de forma asíncrona (no en el mismo request que crea el reclamo).

```json
{
  "_id": "CUS-739201",
  "customer_id": "CUS-739201",
  "name": "Cliente Ejemplo",
  "email": "cliente@mail.com",
  "claim_summary": { "total_claims": 8, "open_claims": 2, "last_claim_at": "2026-06-21T10:15:00Z" },
  "recent_claims": [
    { "claim_id": "CLM-20260621-01J1P9Y7K8M2A6", "claim_type": "late_delivery", "current_status": "in_review", "created_at": "2026-06-21T10:15:00Z" }
  ],
  "monthly_stats": [ { "month": "2026-06", "claims_created": 3 } ]
}
```

`recent_claims` mantiene solo los últimos 5 reclamos (`$slice: -5`), aplicando el patrón *Bucket*. `claim_summary.open_claims` se incrementa en cada `ClaimCreated`; no hay lógica que lo decremente al cerrar un reclamo en esta entrega (limitación conocida, ver sección "Trabajo futuro").

## 4.3.4. Documentos resumen: `products` y `sellers`

Permiten responder consultas de recurrencia (RF07) sin escanear todos los reclamos.

```json
{
  "_id": "PRD-SKU-88991",
  "product_id": "PRD-SKU-88991",
  "name": "Audifonos inalambricos",
  "category": "Tecnologia",
  "claim_summary": { "total_claims": 12, "open_claims": 4, "last_claim_at": "2026-06-21T10:15:00Z" },
  "monthly_stats": [ { "month": "2026-06", "claims_created": 7 } ]
}
```

```json
{
  "_id": "SEL-1021",
  "seller_id": "SEL-1021",
  "name": "Tech Store Peru",
  "claim_summary": { "total_claims": 24, "open_claims": 6 },
  "monthly_stats": [ { "month": "2026-06", "claims_created": 10 } ]
}
```

`monthly_stats` en esta entrega solo cuenta `claims_created` por mes (sin desglose por `claim_type` ni por incumplimiento de SLA) — desglose más fino queda como trabajo futuro.

## 4.3.5. Documento JSON de eventos: `outbox_events`

Implementa consistencia eventual entre MongoDB y Neo4j (y con `customers`/`products`/`sellers`). El evento se registra en MongoDB en el mismo request que crea o modifica el reclamo; un **worker asíncrono en background**, corriendo dentro del propio proceso de la API, lo consume después.

```json
{
  "_id": "EVT-01J1PA0J9SD4F",
  "event_id": "EVT-01J1PA0J9SD4F",
  "event_type": "ClaimCreated",
  "aggregate_type": "Claim",
  "aggregate_id": "CLM-20260621-01J1P9Y7K8M2A6",
  "payload": {
    "claim_id": "CLM-20260621-01J1P9Y7K8M2A6",
    "customer_id": "CUS-739201",
    "product_id": "PRD-SKU-88991",
    "seller_id": "SEL-1021",
    "carrier_id": "CAR-05",
    "zone_id": "ZON-lima-norte",
    "claim_type": "late_delivery"
  },
  "status": "PENDING",
  "created_at": "2026-06-21T10:15:02Z",
  "processed_at": null,
  "retry_count": 0,
  "last_error": null
}
```

Tipos de evento implementados: `ClaimCreated` (al registrar) y `ClaimStatusChanged` (al cambiar de estado). El worker sondea cada `OUTBOX_POLL_INTERVAL_SECONDS` (default 10s), procesa hasta `OUTBOX_BATCH_SIZE` eventos por ciclo, y ante un error incrementa `retry_count`; al llegar a `OUTBOX_MAX_RETRIES` (default 5) el evento pasa a `status: "FAILED"` (terminal, no se reintenta más).

Al procesar `ClaimCreated`, el worker: actualiza `customers`/`products`/`sellers`, proyecta el reclamo en Neo4j, registra una notificación (`notifications`), y marca `claims.graph_sync_status = "synced"`.

## 4.3.6. Documento de metadatos: `claim_attachments`

La evidencia **completa** (URL, tipo, descripción) vive aquí, no en `claims` — el reclamo solo embebe un resumen acotado (`evidence_summary`, ver 4.3.2). Esto evita que el documento principal crezca sin límite si un reclamo acumula muchas evidencias.

```json
{
  "_id": "ATT-01J1P9Z2",
  "attachment_id": "ATT-01J1P9Z2",
  "claim_id": "CLM-20260621-01J1P9Y7K8M2A6",
  "type": "image",
  "url": "https://storage-provider.example.com/claims/2026/06/photo1.jpg",
  "description": "Foto del paquete recibido",
  "uploaded_at": "2026-06-21T10:15:00Z"
}
```

## 4.3.7. Documento de auditoría: `notifications`

Registra que se generó una notificación ante un evento del reclamo (RF09). El envío real (correo/SMS) está simulado — `status` siempre queda en `"simulated"`; no hay integración con un proveedor de notificaciones real en esta entrega.

```json
{
  "_id": "NTF-01J1PA5K",
  "notification_id": "NTF-01J1PA5K",
  "claim_id": "CLM-20260621-01J1P9Y7K8M2A6",
  "channel": "email",
  "event_type": "ClaimCreated",
  "status": "simulated",
  "created_at": "2026-06-21T10:15:05Z"
}
```

---

## 4.4. Diseño en Neo4j ajustado por consultas

El diseño de Neo4j se define a partir de las consultas previstas del grafo. Una entidad se modela como nodo únicamente si participa en recorridos de concentración de incidencias o relación entre reclamos. Por ello, `Order` (pedido) **no se modela como nodo independiente** — queda como snapshot en MongoDB y como propiedades del nodo `Claim` en Neo4j.

### 4.4.1. Consultas previstas en Neo4j

| Código | Consulta | Nodos involucrados | Justificación | RF | Implementación actual |
|---|---|---|---|---|---|
| QG01 | Reclamos relacionados por el mismo producto | Claim, Product | Detectar productos con fallas recurrentes | RF08 | `GET /claims/{id}/related` (parte del recorrido multi-entidad) |
| QG02 | Vendedores con mayor concentración de reclamos | Claim, Product, Seller | Evaluar problemas operativos de un vendedor | RF07 | `GET /analytics/sellers-at-risk` (Mongo) |
| QG03 | Operadores logísticos asociados a reclamos recurrentes | Claim, Carrier | Analizar incidencias de entrega/demora | RF08 | Cubierto dentro de `GET /claims/{id}/related` |
| QG04 | Zonas con mayor concentración de incidencias | Claim, Zone | Problemas por zona de entrega | RF07 | `GET /analytics/recurring-incidents` (Neo4j, todas las entidades mezcladas) |
| QG05 | Clientes con concentración de reclamos | Claim, Customer | Seguimiento postventa | RF07 | `GET /analytics/customers-summary` (Mongo) + `recurring-incidents` (Neo4j) |
| QG06 | Reclamos relacionados por entidades compartidas, **incluyendo conexiones no evidentes** | Claim, Customer, Product, Seller, Carrier, Zone | Identificar conexiones no evidentes al analizar reclamos aislados | RF08 | `GET /claims/{id}/related` — **traversal transitivo multi-hop** (`max_hops`, hasta 2 reclamos intermedios), no solo entidades compartidas directamente |

Nota de implementación: QG02/QG04/QG05 se cubren de forma consolidada (un único endpoint por tipo de entidad en Mongo, más un recorrido combinado en Neo4j) en vez de una consulta Cypher separada por cada QG — misma cobertura funcional, menos endpoints.

### 4.4.2. Nodos y relaciones

| Etiqueta de nodo | Propiedades principales | Llave/constraint | Uso |
|---|---|---|---|
| `Claim` | `claim_id`, `claim_type`, `current_status`, `priority`, `created_at`, `order_id`, `purchase_date`, `amount` | `claim_id` UNIQUE | Nodo central del grafo; `Order` no es nodo, sus datos quedan como propiedades aquí |
| `Customer` | `customer_id`, `name` | `customer_id` UNIQUE | Reclamos por cliente y concentración de incidencias |
| `Product` | `product_id`, `name`, `category` | `product_id` UNIQUE | Productos con alta recurrencia de reclamos |
| `Seller` | `seller_id`, `name` | `seller_id` UNIQUE | Vendedores con concentración de incidencias |
| `Carrier` | `carrier_id`, `name` | `carrier_id` UNIQUE | Análisis de reclamos logísticos |
| `Zone` | `zone_id`, `name`, `region` | `zone_id` UNIQUE | Concentración por zona de entrega |

| Relación | Origen → Destino | Propiedades | Justificación |
|---|---|---|---|
| `REGISTERED_BY` | `Claim → Customer` | `created_at` | Cuándo se registró el reclamo |
| `ABOUT_PRODUCT` | `Claim → Product` | `amount` | Monto del pedido asociado al reclamo |
| `SOLD_BY` | `Product → Seller` | — | Vendedor responsable del producto. Sin propiedades: no hay dato de "vigencia de venta" en el modelo actual |
| `HANDLED_BY` | `Claim → Carrier` | `tracking_code` (puede ser `null`) | Código de seguimiento cuando el reclamo tiene componente logístico |
| `OCCURS_IN_ZONE` | `Claim → Zone` | — | Zona de entrega. Sin propiedades: no se captura dirección de entrega en el modelo actual |

Se decidió **no inventar** propiedades sin una fuente de datos real (ej. "antigüedad de la relación vendedor-producto" o "hash de dirección de entrega") — se dejan sin esas propiedades en vez de rellenarlas con valores ficticios.

### 4.4.3. Ejemplo de creación/actualización del grafo

```cypher
MERGE (c:Claim {claim_id: $claim_id})
SET c.claim_type = $claim_type,
    c.current_status = $current_status,
    c.priority = $priority,
    c.created_at = datetime($created_at),
    c.order_id = $order_id,
    c.purchase_date = $purchase_date,
    c.amount = $amount

MERGE (cu:Customer {customer_id: $customer_id}) SET cu.name = $customer_name
MERGE (p:Product {product_id: $product_id}) SET p.name = $product_name, p.category = $product_category
MERGE (s:Seller {seller_id: $seller_id}) SET s.name = $seller_name
MERGE (ca:Carrier {carrier_id: $carrier_id}) SET ca.name = $carrier_name
MERGE (z:Zone {zone_id: $zone_id}) SET z.name = $zone_name

MERGE (c)-[rb:REGISTERED_BY]->(cu) SET rb.created_at = datetime($created_at)
MERGE (c)-[ap:ABOUT_PRODUCT]->(p) SET ap.amount = $amount
MERGE (p)-[:SOLD_BY]->(s)
MERGE (c)-[hb:HANDLED_BY]->(ca) SET hb.tracking_code = $tracking_code
MERGE (c)-[:OCCURS_IN_ZONE]->(z)
```

Cuando el reclamo no tiene `logistics` (ej. `customer_service`), `carrier_id`/`zone_id` toman valores centinela (`"SIN_CARRIER"` / zona derivada de `"Sin zona"`), para que el reclamo siga participando del grafo sin romper los `MERGE`.

### 4.4.4. Consulta de reclamos relacionados (API 3) — directa y transitiva

```cypher
// Directa: todas las entidades compartidas, contadas
MATCH (r:Claim {claim_id: $claim_id})-[]-(e)-[]-(other:Claim)
WHERE other.claim_id <> r.claim_id
WITH other,
     collect(DISTINCT labels(e)[0]) AS entity_types,
     collect(DISTINCT coalesce(e.product_id, e.seller_id, e.carrier_id, e.zone_id, e.customer_id)) AS entities
RETURN other.claim_id, other.claim_type, other.current_status,
       2 AS hops, entity_types, entities, size(entities) * 0.25 AS score
```

```cypher
// Transitiva: reclamos conectados a traves de una cadena de reclamos intermedios
MATCH path = (r:Claim {claim_id: $claim_id})-[*4..6]-(other:Claim)
WHERE other.claim_id <> $claim_id AND NOT other.claim_id IN $exclude_ids
WITH other, path, length(path) AS hops
ORDER BY hops ASC
WITH other, min(hops) AS hops, collect(path)[0] AS shortest_path
WITH other, hops, [n IN nodes(shortest_path) WHERE NOT n:Claim] AS chain
RETURN other.claim_id, other.claim_type, other.current_status, hops,
       [n IN chain | labels(n)[0]] AS entity_types,
       [n IN chain | coalesce(n.name, n.customer_id, n.product_id, n.seller_id, n.carrier_id, n.zone_id)] AS shared_entities,
       round(1.0 / (hops / 2.0), 2) AS score
```

Son dos consultas separadas (no una sola con camino de longitud variable) para no perder, en el caso directo, el conteo completo de entidades compartidas. La API devuelve ambos conjuntos combinados y ordenados por `score`, cada resultado con un campo adicional `motivo` (frase legible, ej. *"Comparte vendedor y zona directamente"* o *"Conectado via cliente, a traves de 1 reclamo(s) intermedio(s)"*).

---

## 4.5. Relación entre requerimientos y modelo de datos

| Requerimiento | Soporte en MongoDB | Soporte en Neo4j |
|---|---|---|
| RF01 Registro | `claims` con estructura flexible (`details: {}` libre por tipo de reclamo) | Creación del nodo `Claim` y relaciones estructurales derivadas (asíncrono, vía worker) |
| RF02 Evidencias | `claims.evidence_summary` (resumen acotado) + `claim_attachments` (metadatos completos) | No se modela |
| RF03 Ciclo de vida | `current_status`, `sla.due_at`/`breached` (calculado según `priority`) | Propiedad `current_status` en `Claim`, actualizada por `PUT /status` |
| RF04 Trazabilidad | `status_history` completo dentro de `claims` | No se modela — la trazabilidad es responsabilidad de MongoDB |
| RF05 Consulta cliente | `GET /claims/{id}` + `GET /claims?customer_id=...`, índice compuesto | No se modela |
| RF06 Consulta operativa | Índices compuestos por estado, tipo, fecha, pedido, producto, vendedor; paginación `limit`/`offset` | No se modela |
| RF07 Incidencias recurrentes | `customers`/`products`/`sellers` con `claim_summary`/`monthly_stats` | `recurring_entities` — recorrido de 1 salto, agregación por tipo de entidad |
| RF08 Relaciones entre reclamos | No se modela | `GET /claims/{id}/related` — recorridos multi-hop, directos y transitivos |
| RF09 Notificaciones | `notifications` (auditoría) + `outbox_events` (disparador) | No aplica |

---

## 5. Particionamiento e indexación

### 5.1. Particionamiento en MongoDB

Recomendación para cuando el volumen de reclamos crezca a escala nacional (no implementado en esta entrega — el proyecto corre como instancia única de MongoDB en Docker Compose):

```javascript
sh.shardCollection(
  "marketplace_claims.claims",
  { "created_bucket": 1, "claim_id_hash": "hashed" }
)
```

| Criterio | Decisión | Justificación |
|---|---|---|
| Volumen temporal | `created_bucket` mensual | Los reclamos se consultan por fecha, SLA y reportes mensuales |
| Distribución de escritura | `claim_id_hash` | Evita concentración de escrituras en un solo nodo |
| Datos históricos | Colecciones/zonas para datos fríos | Reclamos cerrados antiguos pueden moverse a almacenamiento menos costoso |
| Evidencias | Archivos fuera de MongoDB, metadatos en `claim_attachments` | Evita documentos excesivamente grandes |

### 5.2. Particionamiento en Neo4j

No se particiona el grafo en esta versión — los análisis requieren recorrer conexiones entre entidades. La estrategia inicial escalaría con réplicas de lectura y un nodo líder para escrituras derivadas.

### 5.3. Índices en MongoDB (implementados, `db/mongo.py::ensure_indexes`)

| Colección | Índice | Tipo | Requerimiento |
|---|---|---|---|
| `claims` | `{ claim_id: 1 }` | Único | Consulta directa del reclamo |
| `claims` | `{ "customer.customer_id": 1, created_at: -1 }` | Compuesto | RF05 |
| `claims` | `{ current_status: 1, priority: 1, created_at: -1 }` | Compuesto | RF03, RF06 |
| `claims` | `{ claim_type: 1, created_at: -1 }` | Compuesto | RF06 |
| `claims` | `{ "order.order_id": 1 }` | Simple | RF01, RF06 |
| `claims` | `{ "product.product_id": 1, created_at: -1 }` | Compuesto | RF07 |
| `claims` | `{ "seller.seller_id": 1, created_at: -1 }` | Compuesto | RF07 |
| `claims` | `{ "logistics.carrier.carrier_id": 1, "logistics.zone.name": 1, created_at: -1 }` | Compuesto | RF07 |
| `customers` | `{ customer_id: 1 }` | Único | RF07 |
| `products` | `{ product_id: 1 }` | Único | RF07 |
| `products` | `{ "monthly_stats.month": 1, category: 1 }` | Compuesto | RF07 |
| `sellers` | `{ seller_id: 1 }` | Único | RF07 |
| `sellers` | `{ "monthly_stats.month": 1 }` | Simple | RF07 |
| `outbox_events` | `{ event_id: 1 }` | Único | Soporte transversal |
| `outbox_events` | `{ status: 1, created_at: 1 }` | Compuesto | Worker de sincronización |
| `notifications` | `{ claim_id: 1, created_at: -1 }` | Compuesto | RF09 |
| `claim_attachments` | `{ attachment_id: 1 }` | Único | RF02 |
| `claim_attachments` | `{ claim_id: 1, uploaded_at: -1 }` | Compuesto | RF02 |

Nota: `search_claims` ordena por `{ created_at: -1, claim_id: 1 }` (con `claim_id` como desempate), no solo por `created_at` — necesario para que la paginación (`skip`/`limit`) sea estable cuando varios reclamos comparten el mismo timestamp.

### 5.4. Índices y restricciones en Neo4j (implementados, `db/neo4j.py::create_constraints`)

```cypher
CREATE CONSTRAINT claim_id_unique IF NOT EXISTS FOR (c:Claim) REQUIRE c.claim_id IS UNIQUE;
CREATE CONSTRAINT customer_id_unique IF NOT EXISTS FOR (c:Customer) REQUIRE c.customer_id IS UNIQUE;
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.product_id IS UNIQUE;
CREATE CONSTRAINT seller_id_unique IF NOT EXISTS FOR (s:Seller) REQUIRE s.seller_id IS UNIQUE;
CREATE CONSTRAINT carrier_id_unique IF NOT EXISTS FOR (c:Carrier) REQUIRE c.carrier_id IS UNIQUE;
CREATE CONSTRAINT zone_id_unique IF NOT EXISTS FOR (z:Zone) REQUIRE z.zone_id IS UNIQUE;
CREATE INDEX claim_type_created_at IF NOT EXISTS FOR (c:Claim) ON (c.claim_type, c.created_at);
CREATE INDEX claim_status IF NOT EXISTS FOR (c:Claim) ON (c.current_status);
```

---

## 6. Diseño de APIs RESTful

Se implementan **3 APIs principales**, alineadas a los flujos más importantes del negocio: registrar reclamos, consultar detalle y explorar relaciones. Funcionalidad adicional (cambio de estado, analítica) está implementada y operativa, pero queda fuera de las 3 APIs obligatorias del alcance de esta entrega.

| API | Endpoint | Método | Requerimientos | Base |
|---|---|---|---|---|
| API 1 | `/api/v1/claims` | POST | RF01, RF02, RF03, RF04 | MongoDB + outbox + Neo4j (asíncrono) |
| API 2 | `/api/v1/claims/{claim_id}` | GET | RF04, RF05, RF06 | MongoDB |
| API 3 | `/api/v1/claims/{claim_id}/related` | GET | RF07 (parcial), RF08 | Neo4j |
| Extra | `/api/v1/claims` | GET | RF06 | MongoDB (búsqueda + paginación) |
| Extra | `/api/v1/claims/{claim_id}/status` | PUT | RF03, RF04 | MongoDB + outbox + Neo4j (asíncrono) |
| Extra | `/api/v1/analytics/*` (6 endpoints) | GET | RF06, RF07 | MongoDB + Neo4j |

Corrección respecto al planteamiento original: RF09 (Notificaciones) **no** se satisface desde la API 3 ni desde la analítica — se satisface por el worker asíncrono de outbox, que genera un documento en `notifications` en cada `ClaimCreated`/`ClaimStatusChanged`, de forma transversal a cualquier endpoint.

### 6.1. API 1: Registrar reclamo postventa

| Campo | Detalle |
|---|---|
| Endpoint | `POST /api/v1/claims` |
| Objetivo | Registrar un reclamo asociado a una compra, con datos variables y evidencias opcionales |
| Entrada | `claim_type`, `channel`, `priority`, `customer`, `order`, `product`, `seller`, `logistics` (opcional), `details`, `evidence` |
| Salida exitosa | `201 Created` con `claim_id` (generado por el servidor, no por el cliente), `current_status`, `message` |
| Errores | `422 Unprocessable Entity` (validación), `409 Conflict` (colisión de ID, prácticamente imposible al ser ULID) |
| Persistencia | Inserta en `claims` + `claim_attachments`; registra evento `ClaimCreated` en outbox. **No** espera a Neo4j ni a los resúmenes — responde de inmediato |

```http
POST /api/v1/claims
Content-Type: application/json

{
  "claim_type": "defective_product",
  "channel": "web",
  "priority": "medium",
  "customer": { "customer_id": "CUS-001", "name": "Juan Perez", "email": "juan.perez@email.com" },
  "order": { "order_id": "ORD-1002", "purchase_date": "2026-06-22", "amount": 199.90 },
  "product": { "product_id": "PRD-501", "name": "Audifonos Bluetooth", "category": "Tecnologia" },
  "seller": { "seller_id": "SEL-010", "name": "Tech Store Peru" },
  "logistics": {
    "carrier": { "carrier_id": "CAR-001", "name": "Rapido Express" },
    "zone": { "zone_id": "ZON-lima-norte", "name": "Lima Norte", "region": "Lima" },
    "promised_date": "2026-06-22",
    "tracking_code": "TRK-70001"
  },
  "details": { "description": "El producto no enciende despues de la primera carga." },
  "evidence": [{ "type": "image", "url": "https://example.com/evidence/clm-0070/photo1.jpg", "description": "Foto del producto" }]
}
```

```json
201 Created
{ "claim_id": "CLM-20260706-01KWTP7MZ94PXXWW3QSMQ1PNPG", "current_status": "created", "message": "Reclamo registrado correctamente" }
```

**Nota de diseño**: a diferencia del planteamiento original, el cliente **no** envía el ID del reclamo — el servidor lo genera (`CLM-YYYYMMDD-<ULID>`), evitando colisiones y control externo sobre el formato del identificador.

### 6.2. API 2: Consultar detalle de reclamo

| Campo | Detalle |
|---|---|
| Endpoint | `GET /api/v1/claims/{claim_id}` |
| Objetivo | Consultar el estado y detalle completo del reclamo |
| Salida exitosa | `200 OK` con el documento completo, incluyendo `sla.breached` **recalculado en el momento de la consulta** |
| Errores | `404 Not Found` |
| Persistencia | Lee desde MongoDB por `claim_id` (índice único) |

```json
GET /api/v1/claims/CLM-20260620-DEMOSEED01
200 OK
{
  "claim_id": "CLM-20260620-DEMOSEED01",
  "claim_type": "late_delivery",
  "priority": "high",
  "current_status": "created",
  "sla": { "due_at": "2026-07-07T03:02:56Z", "breached": false },
  "logistics": { "carrier": {"carrier_id": "CAR-001", "name": "Rapido Express"}, "zone": {"zone_id": "ZON-lima-norte", "name": "Lima Norte", "region": "Lima"}, "promised_date": "2026-06-19", "tracking_code": "TRK-10001" },
  "status_history": [ "..." ],
  "evidence_summary": { "count": 1, "types": ["image"] }
}
```

Adicionalmente, `GET /api/v1/claims` (extra, no parte de las 3 obligatorias) permite buscar por `current_status`, `claim_type`, `customer_id`, `product_id`, `seller_id`, con paginación `limit`/`offset`.

### 6.3. API 3: Explorar relaciones del reclamo

| Campo | Detalle |
|---|---|
| Endpoint | `GET /api/v1/claims/{claim_id}/related` |
| Objetivo | Mostrar reclamos relacionados por entidades compartidas: cliente, producto, vendedor, operador logístico o zona — **directa o transitivamente** |
| Parámetros | `claim_id` (path), `max_hops` (query, 2-6, default 4), `limit` (query, default 10) |
| Salida exitosa | `200 OK` con reclamos relacionados, `motivo` legible, entidades compartidas y `score` |
| Errores | `404 Not Found` (reclamo no existe en MongoDB) |
| Persistencia | Consulta Neo4j; no persiste el resultado (se calcula on-demand en cada llamada) |

```json
GET /api/v1/claims/CLM-20260620-DEMOSEED01/related
200 OK
{
  "claim_id": "CLM-20260620-DEMOSEED01",
  "related": [
    {
      "claim_id": "CLM-20260621-DEMOSEED02",
      "claim_type": "defective_product",
      "current_status": "created",
      "hops": 2,
      "motivo": "Comparte zona y operador logistico y producto directamente",
      "entity_types": ["Zone", "Carrier", "Product"],
      "shared_entities": ["ZON-lima-norte", "CAR-001", "PRD-501"],
      "score": 0.75
    },
    {
      "claim_id": "CLM-20260623-DEMOSEED04",
      "claim_type": "return_rejected",
      "current_status": "created",
      "hops": 4,
      "motivo": "Conectado via cliente y producto, a traves de 1 reclamo(s) intermedio(s)",
      "entity_types": ["Customer", "Product"],
      "shared_entities": ["Juan Perez", "Zapatillas Running"],
      "score": 0.5
    }
  ]
}
```

**Diferencia clave respecto al planteamiento original**: la búsqueda no se limita a entidades compartidas *directamente* — con `max_hops > 2` también encuentra reclamos conectados a través de una cadena de reclamos intermedios (QG06: "conexiones no evidentes al analizar reclamos aislados"), algo que en SQL exigiría consultas recursivas y que en Neo4j es una sola expresión de camino de longitud variable.

### 6.4. Extra: analítica (no forma parte de las 3 APIs obligatorias)

`GET /api/v1/analytics/operational-summary` combina indicadores de MongoDB (conteos por estado, tipo, canal, top productos/vendedores) con `recurring_entities` de Neo4j en una sola respuesta. Endpoints adicionales: `customers-summary`, `products-at-risk`, `sellers-at-risk`, `recurring-incidents`, `outbox` (observabilidad del patrón de sincronización asíncrona).

### 6.5. Consideraciones REST y OpenAPI

- Rutas con sustantivos (`claims`, `related`), no verbos.
- Versionamiento en la ruta: `/api/v1`.
- Cada solicitud es *stateless*.
- Códigos HTTP: `201` creación, `200` consulta, `404` no encontrado, `422` validación (FastAPI/Pydantic).
- **Paginación implementada**: `GET /claims` soporta `limit`/`offset`, con `total_coincidencias` en la respuesta para que el cliente calcule si hay más páginas.
- FastAPI genera la documentación OpenAPI/Swagger automáticamente; `POST /claims` incluye además un selector de 7 ejemplos (uno por `claim_type`) definidos en `claim_examples.py`, seleccionables directamente en el "Try it out" de Swagger sin copiar JSON de ningún archivo aparte.

---

## Trabajo futuro (fuera de alcance de esta entrega, documentado a propósito)

- PII enmascarada (`document_hash`, `email_masked` en `customer`).
- Enriquecimiento de nodos sin fuente de datos en el payload actual (`Customer.segment/risk_score`, `Seller.marketplace_score`, `Product.brand`).
- `monthly_stats` desglosado por `claim_type` y por incumplimiento de SLA.
- Decremento de `open_claims`/incremento de `closed_claims` en `customers`/`products`/`sellers` al cerrar un reclamo.
- Almacenamiento real de archivos (MinIO/S3) — hoy `claim_attachments.url` es una referencia simulada; el contrato de la API ya está diseñado para aceptar una URL real sin cambios de esquema.
- Sharding de MongoDB (sección 5.1) — recomendación para escala futura, no implementado en esta instancia de desarrollo.
