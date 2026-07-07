import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.mongo import ensure_indexes, get_database, wait_for_mongo
from app.db.neo4j import close_neo4j_driver, create_constraints, wait_for_neo4j
from app.routes import analytics, claims
from app.services.outbox_worker import outbox_worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_mongo()
    ensure_indexes()
    wait_for_neo4j()
    create_constraints()

    worker_task = asyncio.create_task(outbox_worker_loop())
    yield

    worker_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await worker_task
    close_neo4j_driver()


app = FastAPI(
    title="Sistema NoSQL de Reclamos Postventa",
    description="""
API academica para la gestion inteligente de reclamos postventa en un marketplace retail.

**MongoDB** es la fuente oficial del reclamo. Guarda documentos flexibles, la evidencia
completa en `claim_attachments` y colecciones resumen (`customers`, `products`, `sellers`).

**Neo4j** es una vista derivada para analisis. Solo modela nodos que responden a consultas del grafo:
`Claim`, `Customer`, `Product`, `Seller`, `Carrier` y `Zone`. `Order` no se modela como nodo porque
no hay consultas especificas sobre pedidos; sus datos quedan como propiedades del reclamo.

Un worker en background consume `outbox_events` para propagar los cambios de `claims` hacia los
resumenes documentales y hacia Neo4j sin bloquear las peticiones HTTP.
""",
    version="3.0.0",
    openapi_tags=[
        {"name": "01. Sistema", "description": "Validacion de disponibilidad de la API."},
        {"name": "02. Reclamos", "description": "Registro, consulta, actualizacion y relaciones de reclamos."},
        {"name": "03. Analisis", "description": "Resumen operativo, recurrencias y documentos resumen."},
    ],
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(claims.router)
app.include_router(analytics.router)


@app.get("/", tags=["01. Sistema"])
def home():
    return {
        "mensaje": "API Sistema NoSQL de Reclamos Postventa",
        "swagger": "/docs",
        "health": "/health",
        "neo4j_browser": "http://localhost:7474",
    }


@app.get("/health", tags=["01. Sistema"])
def health_check():
    get_database().command("ping")
    return {"status": "ok", "servicio": "reclamos-api", "mongo": "ok", "neo4j": "ok"}
