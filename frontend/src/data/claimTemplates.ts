import type { ClaimCreate, ClaimType } from "../types/domain";

export const CLAIM_TEMPLATES: Record<ClaimType, ClaimCreate> = {
  defective_product: {
    claim_type: "defective_product",
    channel: "web",
    priority: "medium",
    customer: { customer_id: "CUS-001", name: "Juan Perez", email: "juan.perez@email.com" },
    order: { order_id: "ORD-1002", purchase_date: "2026-06-22", amount: 199.9 },
    product: { product_id: "PRD-501", name: "Audifonos Bluetooth", category: "Tecnologia" },
    seller: { seller_id: "SEL-010", name: "Tech Store Peru" },
    logistics: {
      carrier: { carrier_id: "CAR-001", name: "Rapido Express" },
      zone: { zone_id: "ZON-lima-norte", name: "Lima Norte", region: "Lima" },
      promised_date: "2026-06-22",
      tracking_code: "TRK-70001",
    },
    details: {
      description: "El producto no enciende despues de la primera carga.",
      expected_resolution: "Cambio o devolucion",
    },
    evidence: [
      { type: "image", url: "https://example.com/evidence/clm-0070/photo1.jpg", description: "Foto del producto" },
    ],
  },
  late_delivery: {
    claim_type: "late_delivery",
    channel: "mobile_app",
    priority: "high",
    customer: { customer_id: "CUS-001", name: "Juan Perez", email: "juan.perez@email.com" },
    order: { order_id: "ORD-1001", purchase_date: "2026-06-20", amount: 349.9 },
    product: { product_id: "PRD-501", name: "Audifonos Bluetooth", category: "Tecnologia" },
    seller: { seller_id: "SEL-010", name: "Tech Store Peru" },
    logistics: {
      carrier: { carrier_id: "CAR-001", name: "Rapido Express" },
      zone: { zone_id: "ZON-lima-norte", name: "Lima Norte", region: "Lima" },
      promised_date: "2026-06-19",
      tracking_code: "TRK-70002",
    },
    details: { description: "El pedido figura como entregado, pero no fue recibido." },
    evidence: [
      {
        type: "image",
        url: "https://example.com/evidence/dummy-tardia/foto1.jpg",
        description: "Foto de la puerta sin el paquete",
      },
    ],
  },
  incomplete_delivery: {
    claim_type: "incomplete_delivery",
    channel: "store",
    priority: "medium",
    customer: { customer_id: "CUS-004", name: "Rosa Fernandez", email: "rosa.fernandez@email.com" },
    order: { order_id: "ORD-3001", purchase_date: "2026-06-25", amount: 89.9 },
    product: { product_id: "PRD-503", name: "Set de Ollas", category: "Hogar" },
    seller: { seller_id: "SEL-030", name: "Hogar Facil" },
    logistics: {
      carrier: { carrier_id: "CAR-001", name: "Rapido Express" },
      zone: { zone_id: "ZON-lima-norte", name: "Lima Norte", region: "Lima" },
      promised_date: "2026-06-25",
      tracking_code: "TRK-70003",
    },
    details: { description: "Llegaron solo 3 de las 5 piezas del set." },
    evidence: [
      {
        type: "image",
        url: "https://example.com/evidence/dummy-incompleta/foto1.jpg",
        description: "Foto de las piezas recibidas",
      },
    ],
  },
  incorrect_charge: {
    claim_type: "incorrect_charge",
    channel: "call_center",
    priority: "high",
    customer: { customer_id: "CUS-001", name: "Juan Perez", email: "juan.perez@email.com" },
    order: { order_id: "ORD-2001", purchase_date: "2026-06-22", amount: 159.9 },
    product: { product_id: "PRD-502", name: "Zapatillas Running", category: "Calzado" },
    seller: { seller_id: "SEL-020", name: "Deportes Lima" },
    logistics: {
      carrier: { carrier_id: "CAR-002", name: "Olva Courier" },
      zone: { zone_id: "ZON-lima-sur", name: "Lima Sur", region: "Lima" },
      promised_date: "2026-06-24",
      tracking_code: null,
    },
    details: { description: "Se cobro dos veces el mismo pedido." },
    evidence: [
      {
        type: "receipt",
        url: "https://example.com/evidence/dummy-cobro/boleta.pdf",
        description: "Boleta con el cobro duplicado",
      },
    ],
  },
  return_rejected: {
    claim_type: "return_rejected",
    channel: "whatsapp",
    priority: "medium",
    customer: { customer_id: "CUS-003", name: "Carlos Ramirez", email: "carlos.ramirez@email.com" },
    order: { order_id: "ORD-2010", purchase_date: "2026-06-23", amount: 179.9 },
    product: { product_id: "PRD-502", name: "Zapatillas Running", category: "Calzado" },
    seller: { seller_id: "SEL-020", name: "Deportes Lima" },
    logistics: {
      carrier: { carrier_id: "CAR-002", name: "Olva Courier" },
      zone: { zone_id: "ZON-lima-sur", name: "Lima Sur", region: "Lima" },
      promised_date: "2026-06-25",
      tracking_code: null,
    },
    details: { description: "La devolucion fue rechazada sin justificacion clara." },
    evidence: [
      {
        type: "audio",
        url: "https://example.com/evidence/dummy-devolucion/llamada.mp3",
        description: "Grabacion de la llamada con el agente",
      },
      {
        type: "document",
        url: "https://example.com/evidence/dummy-devolucion/politica.pdf",
        description: "Politica de devolucion citada por el cliente",
      },
    ],
  },
  warranty_not_honored: {
    claim_type: "warranty_not_honored",
    channel: "email",
    priority: "high",
    customer: { customer_id: "CUS-005", name: "Diego Torres", email: "diego.torres@email.com" },
    order: { order_id: "ORD-3010", purchase_date: "2026-05-15", amount: 899.0 },
    product: { product_id: "PRD-504", name: "Licuadora Industrial", category: "Electrodomesticos" },
    seller: { seller_id: "SEL-030", name: "Hogar Facil" },
    logistics: null,
    details: {
      description: "El vendedor se niega a aplicar la garantia de 1 anio.",
      expected_resolution: "Reparacion o cambio bajo garantia",
    },
    evidence: [
      {
        type: "document",
        url: "https://example.com/evidence/dummy-garantia/certificado.pdf",
        description: "Certificado de garantia original",
      },
      {
        type: "conversation",
        url: "https://example.com/evidence/dummy-garantia/chat.json",
        description: "Conversacion donde el vendedor rechaza la garantia",
      },
    ],
  },
  customer_service: {
    claim_type: "customer_service",
    channel: "whatsapp",
    priority: "low",
    customer: { customer_id: "CUS-002", name: "Maria Lopez", email: "maria.lopez@email.com" },
    order: { order_id: "ORD-1020", purchase_date: "2026-06-24", amount: 349.9 },
    product: { product_id: "PRD-501", name: "Audifonos Bluetooth", category: "Tecnologia" },
    seller: { seller_id: "SEL-010", name: "Tech Store Peru" },
    logistics: null,
    details: { description: "El agente no dio seguimiento al caso anterior." },
    evidence: [
      {
        type: "conversation",
        url: "https://example.com/evidence/dummy-atencion/chat.json",
        description: "Transcripcion del chat de WhatsApp",
      },
    ],
  },
};
