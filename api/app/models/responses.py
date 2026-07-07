from pydantic import BaseModel


class ApiMessage(BaseModel):
    claim_id: str
    current_status: str
    message: str


class PathNode(BaseModel):
    kind: str
    id: str
    label: str
    claim_type: str | None = None


class RelatedClaim(BaseModel):
    claim_id: str
    claim_type: str | None = None
    current_status: str | None = None
    hops: int = 2
    motivo: str = ""
    entity_types: list[str] = []
    shared_entities: list[str] = []
    score: float = 0.0
    paths: list[list[PathNode]] = []


class RelatedClaimsResponse(BaseModel):
    claim_id: str
    related: list[RelatedClaim]


class HealthResponse(BaseModel):
    status: str
    service: str
    mongo: str
    neo4j: str
