"""
Ejemplos de POST /api/v1/claims, uno por cada claim_type, para que aparezcan
como un selector ("Examples") dentro del "Try it out" de Swagger UI.
"""

CLAIM_EXAMPLES = {
    "producto_defectuoso": {
        "summary": "defective_product — producto que llega dañado o no funciona",
        "value": {
            "claim_type": "defective_product",
            "channel": "web",
            "customer": {"customer_id": "CUS-001", "name": "Juan Perez", "email": "juan.perez@email.com"},
            "order": {"order_id": "ORD-1002", "purchase_date": "2026-06-22", "amount": 199.90},
            "product": {"product_id": "PRD-501", "name": "Audifonos Bluetooth", "category": "Tecnologia"},
            "seller": {"seller_id": "SEL-010", "name": "Tech Store Peru"},
            "carrier": {"carrier_id": "CAR-001", "name": "Rapido Express", "zone": "Lima Norte"},
            "zone": {"zone_id": "ZON-lima-norte", "name": "Lima Norte", "region": "Lima"},
            "details": {
                "description": "El producto no enciende despues de la primera carga.",
                "priority": "media",
                "expected_resolution": "Cambio o devolucion",
            },
            "evidence": [
                {
                    "type": "image",
                    "url": "https://example.com/evidence/clm-0070/photo1.jpg",
                    "description": "Foto del producto",
                }
            ],
        },
    },
    "entrega_tardia": {
        "summary": "late_delivery — el pedido llega despues de lo prometido",
        "value": {
            "claim_type": "late_delivery",
            "channel": "mobile_app",
            "customer": {"customer_id": "CUS-001", "name": "Juan Perez", "email": "juan.perez@email.com"},
            "order": {"order_id": "ORD-1001", "purchase_date": "2026-06-20", "amount": 349.90},
            "product": {"product_id": "PRD-501", "name": "Audifonos Bluetooth", "category": "Tecnologia"},
            "seller": {"seller_id": "SEL-010", "name": "Tech Store Peru"},
            "carrier": {"carrier_id": "CAR-001", "name": "Rapido Express", "zone": "Lima Norte"},
            "zone": {"zone_id": "ZON-lima-norte", "name": "Lima Norte", "region": "Lima"},
            "details": {"description": "El pedido figura como entregado, pero no fue recibido.", "priority": "alta"},
            "evidence": [
                {
                    "type": "image",
                    "url": "https://example.com/evidence/dummy-tardia/foto1.jpg",
                    "description": "Foto de la puerta sin el paquete",
                }
            ],
        },
    },
    "entrega_incompleta": {
        "summary": "incomplete_delivery — llegan menos piezas de las compradas",
        "value": {
            "claim_type": "incomplete_delivery",
            "channel": "store",
            "customer": {"customer_id": "CUS-004", "name": "Rosa Fernandez", "email": "rosa.fernandez@email.com"},
            "order": {"order_id": "ORD-3001", "purchase_date": "2026-06-25", "amount": 89.90},
            "product": {"product_id": "PRD-503", "name": "Set de Ollas", "category": "Hogar"},
            "seller": {"seller_id": "SEL-030", "name": "Hogar Facil"},
            "carrier": {"carrier_id": "CAR-001", "name": "Rapido Express", "zone": "Lima Norte"},
            "zone": {"zone_id": "ZON-lima-norte", "name": "Lima Norte", "region": "Lima"},
            "details": {"description": "Llegaron solo 3 de las 5 piezas del set.", "priority": "media"},
            "evidence": [
                {
                    "type": "image",
                    "url": "https://example.com/evidence/dummy-incompleta/foto1.jpg",
                    "description": "Foto de las piezas recibidas",
                }
            ],
        },
    },
    "cobro_incorrecto": {
        "summary": "incorrect_charge — cobro duplicado o distinto al pactado",
        "value": {
            "claim_type": "incorrect_charge",
            "channel": "call_center",
            "customer": {"customer_id": "CUS-001", "name": "Juan Perez", "email": "juan.perez@email.com"},
            "order": {"order_id": "ORD-2001", "purchase_date": "2026-06-22", "amount": 159.90},
            "product": {"product_id": "PRD-502", "name": "Zapatillas Running", "category": "Calzado"},
            "seller": {"seller_id": "SEL-020", "name": "Deportes Lima"},
            "carrier": {"carrier_id": "CAR-002", "name": "Olva Courier", "zone": "Lima Sur"},
            "zone": {"zone_id": "ZON-lima-sur", "name": "Lima Sur", "region": "Lima"},
            "details": {"description": "Se cobro dos veces el mismo pedido.", "priority": "alta"},
            "evidence": [
                {
                    "type": "receipt",
                    "url": "https://example.com/evidence/dummy-cobro/boleta.pdf",
                    "description": "Boleta con el cobro duplicado",
                }
            ],
        },
    },
    "devolucion_rechazada": {
        "summary": "return_rejected — la devolucion fue negada sin justificacion clara",
        "value": {
            "claim_type": "return_rejected",
            "channel": "whatsapp",
            "customer": {"customer_id": "CUS-003", "name": "Carlos Ramirez", "email": "carlos.ramirez@email.com"},
            "order": {"order_id": "ORD-2010", "purchase_date": "2026-06-23", "amount": 179.90},
            "product": {"product_id": "PRD-502", "name": "Zapatillas Running", "category": "Calzado"},
            "seller": {"seller_id": "SEL-020", "name": "Deportes Lima"},
            "carrier": {"carrier_id": "CAR-002", "name": "Olva Courier", "zone": "Lima Sur"},
            "zone": {"zone_id": "ZON-lima-sur", "name": "Lima Sur", "region": "Lima"},
            "details": {"description": "La devolucion fue rechazada sin justificacion clara.", "priority": "media"},
            "evidence": [
                {
                    "type": "audio",
                    "url": "https://example.com/evidence/dummy-devolucion/llamada.mp3",
                    "description": "Grabacion de la llamada con el agente",
                },
                {
                    "type": "document",
                    "url": "https://example.com/evidence/dummy-devolucion/politica.pdf",
                    "description": "Politica de devolucion citada por el cliente",
                },
            ],
        },
    },
    "garantia_no_reconocida": {
        "summary": "warranty_not_honored — el vendedor se niega a aplicar la garantia",
        "value": {
            "claim_type": "warranty_not_honored",
            "channel": "email",
            "customer": {"customer_id": "CUS-005", "name": "Diego Torres", "email": "diego.torres@email.com"},
            "order": {"order_id": "ORD-3010", "purchase_date": "2026-05-15", "amount": 899.00},
            "product": {"product_id": "PRD-504", "name": "Licuadora Industrial", "category": "Electrodomesticos"},
            "seller": {"seller_id": "SEL-030", "name": "Hogar Facil"},
            "details": {
                "description": "El vendedor se niega a aplicar la garantia de 1 anio.",
                "priority": "alta",
                "expected_resolution": "Reparacion o cambio bajo garantia",
            },
            "evidence": [
                {
                    "type": "document",
                    "url": "https://example.com/evidence/dummy-garantia/certificado.pdf",
                    "description": "Certificado de garantia original",
                },
                {
                    "type": "conversation",
                    "url": "https://example.com/evidence/dummy-garantia/chat.json",
                    "description": "Conversacion donde el vendedor rechaza la garantia",
                },
            ],
        },
    },
    "atencion_cliente": {
        "summary": "customer_service — mal seguimiento o mala atencion, sin logistica de por medio",
        "value": {
            "claim_type": "customer_service",
            "channel": "whatsapp",
            "customer": {"customer_id": "CUS-002", "name": "Maria Lopez", "email": "maria.lopez@email.com"},
            "order": {"order_id": "ORD-1020", "purchase_date": "2026-06-24", "amount": 349.90},
            "product": {"product_id": "PRD-501", "name": "Audifonos Bluetooth", "category": "Tecnologia"},
            "seller": {"seller_id": "SEL-010", "name": "Tech Store Peru"},
            "details": {"description": "El agente no dio seguimiento al caso anterior.", "priority": "baja"},
            "evidence": [
                {
                    "type": "conversation",
                    "url": "https://example.com/evidence/dummy-atencion/chat.json",
                    "description": "Transcripcion del chat de WhatsApp",
                }
            ],
        },
    },
}
