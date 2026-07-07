# Sistema NoSQL de Reclamos Postventa

Proyecto académico alineado al informe definitivo y al feedback del profesor:

- **MongoDB** es la fuente oficial del reclamo.
- **Neo4j** es una vista derivada para análisis de relaciones.
- **Order (pedido) no se modela como nodo en Neo4j**, porque no hay consultas específicas sobre pedidos. Sus datos quedan como propiedades del nodo `Claim` y como snapshot dentro del documento MongoDB.
- La sincronización entre MongoDB y Neo4j, y la actualización de los documentos resumen, ocurren de forma **asíncrona**: un worker en background consume `outbox_events` para propagarlas, sin bloquear la respuesta del registro del reclamo.

## Por qué NoSQL (y no solo "porque guarda archivos")

Que un documento pueda referenciar imágenes, videos o PDFs **no es, por sí solo, un argumento a favor de NoSQL** — una tabla SQL con una columna `VARCHAR url` apuntando a S3 hace exactamente lo mismo. Los argumentos reales de este proyecto son:

1. **Esquema flexible por tipo de reclamo** (`claims.details: {}`): cada `claim_type` necesita campos distintos sin migraciones ni columnas nulas.
2. **Snapshots embebidos sin joins** (RF05/RF06): `claims` guarda el snapshot completo de `customer/order/product/seller/carrier/zone` en un solo documento — una lectura, no cinco joins.
3. **Historial de longitud variable embebido** (RF04): `status_history` crece dentro del mismo documento, sin tabla hija ni FK.
4. **Relaciones multi-hop nativas en Neo4j** (RF07/RF08): "reclamos relacionados por entidades compartidas" es una traversal de grafo; en SQL serían varios self-joins costosos a medida que crece el volumen.

La arquitectura poliglota (documento para la fuente + grafo para relaciones) es el argumento central, no el almacenamiento de archivos.

## Arquitectura

Servicios Docker:

- `reclamos_api`: API Python + FastAPI.
- `reclamos_mongo`: MongoDB 7.
- `reclamos_neo4j`: Neo4j 5 Community.
- `reclamos_neo4j_seed`: contenedor de un solo uso que carga el grafo de ejemplo en Neo4j al arrancar (ver "Datos iniciales").

Capas de la API (`api/app/`), pensadas para poder agregar funcionalidad nueva sin tocar el resto:

- `routes/`: HTTP únicamente, delega a `services/`.
- `services/`: orquesta la lógica de negocio (`claim_service.py`) y el worker de outbox (`outbox_worker.py`).
- `repositories/`: único lugar que sabe de Mongo/Neo4j (uno por colección/dominio).
- `db/`: conexión y arranque de Mongo/Neo4j.
- `models/`: esquemas Pydantic de entrada/salida (`claim.py`, `common.py`, `responses.py`) y los 7 payloads de ejemplo para Swagger en `claim_examples.py`.
- `core/`: configuración (variables de entorno) y generación de IDs (ULID).

Flujo de escritura (`POST /api/v1/claims`):

```
1. Genera claim_id, inserta en `claims` + `claim_attachments`.
2. Crea evento `ClaimCreated` en `outbox_events` (status: PENDING).
3. Responde de inmediato (no espera a Neo4j ni a los resumenes).
        │
        ▼ (en paralelo, cada OUTBOX_POLL_INTERVAL_SECONDS)
4. El worker en background lee eventos PENDING y:
   - actualiza `customers` / `products` / `sellers`
   - proyecta el reclamo en Neo4j
   - registra una `notification`
   - marca el evento PROCESSED (o reintenta hasta OUTBOX_MAX_RETRIES, luego FAILED)
```

## Trazabilidad de requerimientos

### Funcionales

| RF | Descripción | Cómo se cubre |
|---|---|---|
| RF01 | Registro de reclamo | `POST /api/v1/claims` |
| RF02 | Evidencias | `claim_attachments` (metadata completa, expuesta vía `GET /claims/{id}/attachments`) + `evidence_summary` embebido y acotado en `claims` |
| RF03 | Ciclo de vida | `current_status` inicial `created`; `PUT /claims/{id}/status` transiciona el estado; `sla.due_at`/`breached` calculado según `priority` (ver Modelo MongoDB) |
| RF04 | Trazabilidad | `status_history` embebido en `claims`, un evento por transición |
| RF05 | Consulta cliente | `GET /claims/{id}` (detalle) + `GET /claims?customer_id=...` (filtrado) |
| RF06 | Consulta operativa | `GET /claims` con filtros y paginación (`limit`/`offset`) + endpoints de `analytics` |
| RF07 | Incidencias recurrentes | `analytics/recurring-incidents` (Neo4j) + `analytics/products-at-risk` / `sellers-at-risk` (Mongo) |
| RF08 | Relaciones entre reclamos | `GET /claims/{id}/related` — traversal directo y transitivo en Neo4j, calculado on-demand (no se persiste) |
| RF09 | Notificaciones | Colección `notifications`, generada por el worker en cada `ClaimCreated`/`ClaimStatusChanged`. El envío real (email/SMS) está simulado |

### No funcionales

| RNF | Descripción | Cómo se cubre |
|---|---|---|
| RNF01 | Flexibilidad | `claims.details: {}` libre por tipo de reclamo, sin migración de esquema |
| RNF02 | Escalabilidad | Índices compuestos en Mongo (`db/mongo.py::ensure_indexes`) y constraints/índices en Neo4j (`db/neo4j.py::create_constraints`). No se hicieron pruebas de carga/volumen real |
| RNF03 | Disponibilidad | El registro del reclamo no depende de que Neo4j o los resúmenes estén disponibles — el outbox + worker asíncrono absorbe esas fallas y reintenta solo |
| RNF04 | Rendimiento operativo | Lecturas de un solo documento (snapshots embebidos), sin joins; SLA real (`due_at`) permite priorizar sin escanear todo el historial |
| RNF05 | Rendimiento relacional | Traversal nativo en Neo4j para relacionados y recurrentes, en vez de self-joins en SQL |
| RNF06 | Consistencia crítica | Outbox pattern con reintentos da consistencia eventual verificada. Limitación aceptada: si el proceso se cae entre procesar y marcar un evento, un contador podría reprocesarse — no se implementó idempotencia adicional |
| RNF07 | Mantenibilidad | Arquitectura por capas (`routes → services → repositories → db`), una responsabilidad por archivo |

## Modelo MongoDB

Base lógica: `marketplace_claims`.

Colecciones:

- `claims`: documento principal del reclamo.
- `customers`: documento resumen del cliente.
- `products`: documento resumen del producto.
- `sellers`: documento resumen del vendedor.
- `outbox_events`: eventos para consistencia eventual con Neo4j y con los documentos resumen.
- `notifications`: auditoría de notificaciones (RF09).
- `claim_attachments`: metadatos completos de evidencias; en `claims` solo se embebe un resumen acotado (`evidence_summary`).

IDs generados por el propio sistema (formato `PREFIJO-ULID`): `claim_id` (`CLM-YYYYMMDD-<ULID>`), `attachment_id` (`ATT-<ULID>`), `event_id` (`EVT-<ULID>`), `notification_id` (`NTF-<ULID>`), `zone_id` (`ZON-<slug>`). Los IDs de `customer`, `product`, `seller` y `carrier` los provee el sistema externo que administra esas entidades. En todas las colecciones, `_id` coincide con el ID de negocio (evita un `ObjectId` extra) pero no se expone en las respuestas de la API — el cliente solo ve el campo de negocio.

Campos clave de `claims`:

- `priority` (`low`/`medium`/`high`): campo propio del reclamo, no un dato libre dentro de `details`.
- `logistics` (opcional, `null` para reclamos sin componente logístico como `customer_service`): agrupa `carrier`, `zone`, `promised_date` y `tracking_code`.
- `sla: {due_at, breached}`: `due_at` se calcula al crear el reclamo según `priority` (`high` = 24h, `medium` = 72h, `low` = 120h). `breached` se recalcula en cada consulta (`claim_service.enrich_sla`), no se guarda fijo.

## Modelo Neo4j

Nodos: `Claim`, `Customer`, `Product`, `Seller`, `Carrier`, `Zone`.

Relaciones (con propiedades solo donde hay un dato real detrás):

- `(Claim)-[:REGISTERED_BY {created_at}]->(Customer)`
- `(Claim)-[:ABOUT_PRODUCT {amount}]->(Product)`
- `(Product)-[:SOLD_BY]->(Seller)`
- `(Claim)-[:HANDLED_BY {tracking_code}]->(Carrier)`
- `(Claim)-[:OCCURS_IN_ZONE]->(Zone)`

`GET /claims/{id}/related` busca en dos niveles, calculados on-demand (no se persisten como relación en el grafo):

- **Directo** (`hops=2`): comparten al menos una entidad. Cuenta *todas* las entidades compartidas a la vez; `score = 1.00 + 0.05` por cada entidad adicional.
- **Transitivo** (`hops=4, 6...`, hasta `max_hops`): conectados por una cadena de reclamos intermedios, sin compartir nada directo. El `score` sigue una escala por grado de cercanía (`1/grado`, siempre por debajo del directo), y en el primer nivel transitivo (`hops=4`) se afina según cuántos reclamos-puente **distintos** sostienen la conexión.

Esto es lo que realmente aprovecha un motor de grafos: en SQL/Mongo, "quién está conectado a quién sin saber de antemano cuántos pasos hay" exigiría consultas recursivas; en Cypher es una expresión de camino de longitud variable. Cada resultado incluye `motivo` (frase legible) y `paths` (los nodos del camino, listos para visualizar).

`recurring_entities` (usada por `operational-summary`/`recurring-incidents`), en cambio, es un salto de 1 nivel — el equivalente a un `GROUP BY + COUNT` que MongoDB haría igual de bien. El argumento fuerte de "por qué Neo4j" está en `/related`, no ahí.

## Configuración (variables de entorno)

Definidas en `docker-compose.yml` para el servicio `api` (valores por defecto en `api/app/core/config.py`):

| Variable | Default | Uso |
|---|---|---|
| `MONGO_URI` | `mongodb://mongo:27017` | Conexión a MongoDB |
| `MONGO_DB` | `marketplace_claims` | Base lógica |
| `NEO4J_URI` | `bolt://neo4j:7687` | Conexión a Neo4j |
| `NEO4J_USER` / `NEO4J_PASSWORD` | `neo4j` / `password123` | Credenciales de Neo4j |
| `OUTBOX_POLL_INTERVAL_SECONDS` | `10` | Cada cuánto el worker revisa eventos `PENDING` |
| `OUTBOX_BATCH_SIZE` | `20` | Cuántos eventos procesa el worker por ciclo |
| `OUTBOX_MAX_RETRIES` | `5` | Reintentos antes de marcar un evento como `FAILED` |

## Requisitos en la laptop

Solo necesitas:

- Docker Desktop.
- Navegador web.
- Opcional: VS Code con extensión REST Client para ejecutar `pruebas_api.http`.
- Opcional: Node.js si además quieres correr el frontend localmente (ver "Frontend").

No necesitas instalar Python, MongoDB ni Neo4j localmente.

## Ejecución

Desde la carpeta del proyecto:

```powershell
docker compose up -d --build
```

Verifica contenedores:

```powershell
docker compose ps
```

`reclamos_neo4j_seed` va a aparecer como `Exited (0)` — es normal, es el contenedor de un solo uso que carga el grafo de ejemplo en Neo4j y termina (ver "Datos iniciales" más abajo).

Abre Swagger:

```text
http://localhost:8000/docs
```

Health check:

```text
http://localhost:8000/health
```

Neo4j Browser:

```text
http://localhost:7474
Usuario: neo4j
Contraseña: password123
```

## Datos iniciales (seed)

`docker compose up` deja **ambas** bases listas automáticamente, sin pasos manuales:

- **MongoDB** carga `mongo-init/init.js` la primera vez que el volumen está vacío (mecanismo nativo de la imagen oficial de Mongo).
- **Neo4j** no tiene ese mecanismo nativo para archivos `.cypher`. Por eso `docker-compose.yml` define el servicio de un solo uso `neo4j_seed`, que espera a que Neo4j pase su *healthcheck* y entonces ejecuta `neo4j-init/init.cypher` automáticamente.

El seed son 5 reclamos de ejemplo (`CLM-20260620-DEMOSEED01` a `...DEMOSEED05`) cruzados entre 3 clientes, 2 productos, 2 vendedores y 2 operadores/zonas a propósito, para que `GET /related` tenga resultados desde el primer arranque. Cubren 5 de los 7 `claim_type` y los 6 tipos de evidencia (`image, video, receipt, audio, document, conversation`).

Si editas `neo4j-init/init.cypher` y quieres reaplicarlo **sin** borrar los volúmenes (`docker compose down -v`), puedes correr el script manual (todas las sentencias son `MERGE`, por lo que reaplicarlo no duplica datos):

```powershell
.\scripts\cargar_neo4j.ps1
```

## Datos de ejemplo para probar

**Swagger** (`http://localhost:8000/docs`): `POST /api/v1/claims` trae un selector **"Examples"** con 7 payloads listos, uno por cada `claim_type`, definidos en [`api/app/models/claim_examples.py`](api/app/models/claim_examples.py). Elige uno, dale "Try it out" → "Execute" y ya está.

**`pruebas_api.http`** (REST Client de VS Code): cubre los endpoints principales de la API — los 3 núcleo, los extras, las consultas a los reclamos semilla, y los 2 `claim_type` que el seed no cubre (`incomplete_delivery`, `warranty_not_honored`).

## Referencia de endpoints

### Reclamos (`/api/v1/claims`)

| Método y ruta | RF que cubre | Descripción |
|---|---|---|
| `POST /api/v1/claims` | RF01, RF02, RF03, RF04 | Registra el reclamo, guarda evidencia y dispara `ClaimCreated` |
| `GET /api/v1/claims` | RF06 | Busca/lista con filtros (`current_status`, `claim_type`, `customer_id`, `product_id`, `seller_id`) y paginación (`limit`/`offset`) |
| `GET /api/v1/claims/{claim_id}` | RF04, RF05, RF06 | Detalle completo del reclamo, con `sla.breached` recalculado en cada consulta |
| `GET /api/v1/claims/{claim_id}/attachments` | RF02 | Metadata completa de cada evidencia desde `claim_attachments` |
| `PUT /api/v1/claims/{claim_id}/status` | RF03, RF04 | Cambia el estado y dispara `ClaimStatusChanged` |
| `GET /api/v1/claims/{claim_id}/related` | RF07, RF08 | Reclamos relacionados vía Neo4j, directos y transitivos (`max_hops`, rango 2-6, default 4), con `motivo`, `score` y `paths` por resultado |

### Analítica (`/api/v1/analytics`) — extra, no forma parte de las 3 APIs originales pero está operativo

| Método y ruta | RF que cubre | Descripción |
|---|---|---|
| `GET /api/v1/analytics/operational-summary` | RF06, RF07 | Métricas agregadas (por estado, tipo, canal, top productos/vendedores) + entidades recurrentes de Neo4j |
| `GET /api/v1/analytics/customers-summary` | RF06 | Clientes con más reclamos |
| `GET /api/v1/analytics/products-at-risk` | RF07 | Productos con mayor recurrencia |
| `GET /api/v1/analytics/sellers-at-risk` | RF07 | Vendedores con mayor concentración |
| `GET /api/v1/analytics/recurring-incidents` | RF07 | Entidades recurrentes vía Neo4j |
| `GET /api/v1/analytics/outbox` | — (observabilidad) | Estado de los eventos del outbox (`PENDING`/`PROCESSED`/`FAILED`) |

### Sistema

| Método y ruta | Descripción |
|---|---|
| `GET /` | Mensaje de bienvenida + enlaces |
| `GET /health` | Ping a MongoDB y Neo4j |

## Evidencia multimedia (imagen, video, PDF, audio) — alcance actual y extensión futura

`claim_attachments` guarda **metadata** de la evidencia (`type`, `url`, `description`, `uploaded_at`), no el archivo binario — patrón estándar tanto en NoSQL como en SQL: los binarios pesados se suben a un almacenamiento de objetos (S3, MinIO, Azure Blob) y la base de datos solo guarda la referencia.

En esta entrega, la `url` es simulada. El contrato de la API ya está diseñado como si la integración con almacenamiento real existiera:

1. El frontend pide al backend una URL de subida (presigned URL).
2. El backend la genera contra MinIO/S3.
3. El frontend sube el archivo binario directamente a esa URL.
4. El almacenamiento de objetos devuelve la URL final real.
5. Esa URL se guarda en `claim_attachments` — mismo campo, misma forma.

Las URLs de ejemplo usan `example.com`, reservado por la [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606) para documentación (no `.local`, reservado por la RFC 6762 para mDNS).

## Frontend

`frontend/` contiene un cliente en React + Vite + TypeScript (páginas de dashboard, listado, detalle, registro y analítica de reclamos) que consume esta API. Para correrlo:

```powershell
cd frontend
npm install
npm run dev
```

Corre en `http://localhost:5173` (puerto ya habilitado en el CORS de la API). `frontend/.env` define `VITE_API_URL` apuntando a `http://localhost:8000`.

## Comandos útiles

Apagar sin borrar datos:

```powershell
docker compose down
```

Borrar contenedores y datos (necesario si cambia el esquema):

```powershell
docker compose down -v
```

Ver logs de la API (incluye el worker de outbox):

```powershell
docker compose logs -f api
```

Reiniciar solo API:

```powershell
docker compose restart api
```
