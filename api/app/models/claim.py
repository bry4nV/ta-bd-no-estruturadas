from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.common import Carrier, Customer, Evidence, Order, Product, Seller, Zone


class ClaimCreate(BaseModel):
    claim_type: Literal[
        "defective_product",
        "late_delivery",
        "incomplete_delivery",
        "incorrect_charge",
        "return_rejected",
        "warranty_not_honored",
        "customer_service",
    ]
    channel: Literal["web", "mobile_app", "store", "whatsapp", "call_center", "email"]
    customer: Customer
    order: Order
    product: Product
    seller: Seller
    carrier: Carrier | None = None
    zone: Zone | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    evidence: list[Evidence] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {
                "claim_type": "defective_product",
                "channel": "web",
                "customer": {
                    "customer_id": "CUS-001",
                    "name": "Juan Perez",
                    "email": "juan.perez@email.com",
                },
                "order": {
                    "order_id": "ORD-1002",
                    "purchase_date": "2026-06-22",
                    "amount": 199.90,
                },
                "product": {
                    "product_id": "PRD-501",
                    "name": "Audifonos Bluetooth",
                    "category": "Tecnologia",
                },
                "seller": {
                    "seller_id": "SEL-010",
                    "name": "Tech Store Peru",
                },
                "carrier": {
                    "carrier_id": "CAR-001",
                    "name": "Rapido Express",
                    "zone": "Lima Norte",
                },
                "zone": {
                    "zone_id": "ZON-lima-norte",
                    "name": "Lima Norte",
                    "region": "Lima",
                },
                "details": {
                    "description": "El producto no enciende despues de la primera carga.",
                    "priority": "media",
                    "expected_resolution": "Cambio o devolucion",
                },
                "evidence": [
                    {
                        "type": "image",
                        "url": "https://example.com/evidence/clm-0070/photo1.jpg",
                        "description": "Foto del producto recibido",
                    }
                ],
            }
        }
    }


class StatusUpdate(BaseModel):
    current_status: Literal["created", "in_review", "pending_customer", "resolved", "closed", "rejected"]
    comment: str | None = Field(None, examples=["Caso derivado al area logistica"])
    actor_id: str | None = Field("AGT-001", examples=["AGT-001"])
