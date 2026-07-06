from typing import Literal

from pydantic import BaseModel, Field


class Customer(BaseModel):
    customer_id: str = Field(..., examples=["CUS-001"])
    name: str = Field(..., examples=["Juan Perez"])
    email: str | None = Field(None, examples=["juan.perez@email.com"])


class Order(BaseModel):
    order_id: str = Field(..., examples=["ORD-1001"])
    purchase_date: str | None = Field(None, examples=["2026-06-20"])
    amount: float | None = Field(None, examples=[349.90])


class Product(BaseModel):
    product_id: str = Field(..., examples=["PRD-501"])
    name: str = Field(..., examples=["Audifonos Bluetooth"])
    category: str | None = Field("Sin categoria", examples=["Tecnologia"])


class Seller(BaseModel):
    seller_id: str = Field(..., examples=["SEL-010"])
    name: str = Field(..., examples=["Tech Store Peru"])


class Carrier(BaseModel):
    carrier_id: str = Field(..., examples=["CAR-001"])
    name: str = Field(..., examples=["Rapido Express"])
    zone: str | None = Field(None, examples=["Lima Norte"])


class Zone(BaseModel):
    zone_id: str | None = Field(None, examples=["ZON-lima-norte"])
    name: str = Field(..., examples=["Lima Norte"])
    region: str | None = Field(None, examples=["Lima"])


class Logistics(BaseModel):
    carrier: Carrier | None = None
    zone: Zone | None = None
    promised_date: str | None = Field(None, examples=["2026-06-20"])
    tracking_code: str | None = Field(None, examples=["TRK-88991"])


class Evidence(BaseModel):
    type: Literal["image", "video", "audio", "document", "receipt", "conversation"]
    url: str = Field(..., examples=["https://example.com/evidence/clm-0070/photo1.jpg"])
    description: str | None = None
