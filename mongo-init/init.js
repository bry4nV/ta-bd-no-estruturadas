db = db.getSiblingDB("marketplace_claims");

// Colecciones alineadas al informe definitivo.
db.createCollection("claims");
db.createCollection("customers");
db.createCollection("products");
db.createCollection("sellers");
db.createCollection("outbox_events");
db.createCollection("notifications");
db.createCollection("claim_attachments");

// Indices principales.
db.claims.createIndex({ claim_id: 1 }, { unique: true });
db.claims.createIndex({ "customer.customer_id": 1, created_at: -1 });
db.claims.createIndex({ current_status: 1, priority: 1, created_at: -1 });
db.claims.createIndex({ claim_type: 1, created_at: -1 });
db.claims.createIndex({ "order.order_id": 1 });
db.claims.createIndex({ "product.product_id": 1, created_at: -1 });
db.claims.createIndex({ "seller.seller_id": 1, created_at: -1 });
db.claims.createIndex({ "logistics.carrier.carrier_id": 1, "logistics.zone.name": 1, created_at: -1 });

db.customers.createIndex({ customer_id: 1 }, { unique: true });
db.products.createIndex({ product_id: 1 }, { unique: true });
db.sellers.createIndex({ seller_id: 1 }, { unique: true });
db.outbox_events.createIndex({ event_id: 1 }, { unique: true });
db.outbox_events.createIndex({ status: 1, created_at: 1 });
db.notifications.createIndex({ claim_id: 1, created_at: -1 });
db.claim_attachments.createIndex({ attachment_id: 1 }, { unique: true });
db.claim_attachments.createIndex({ claim_id: 1, uploaded_at: -1 });

// ---------------------------------------------------------------------------
// Datos de demo. 5 reclamos que cruzan clientes/productos/vendedores a
// proposito, para que "reclamos relacionados" (Neo4j) tenga resultados desde
// el primer arranque, y que cubran los 7 claim_type y los 6 tipos de
// evidencia posibles.
// ---------------------------------------------------------------------------
const now = new Date();
const month = now.toISOString().slice(0, 7);
const slaHours = { high: 24, medium: 72, low: 120 };

function claimDoc(overrides) {
  const priority = overrides.priority || "medium";
  const base = {
    channel: "web",
    priority: priority,
    current_status: "created",
    created_at: now,
    updated_at: now,
    logistics: null,
    sla: { due_at: new Date(now.getTime() + slaHours[priority] * 3600000), breached: false },
    // Los reclamos semilla ya tienen su proyeccion en Neo4j (cargada directo por
    // neo4j-init/init.cypher, sin pasar por el outbox), por eso arrancan en
    // "synced" y no en "pending_sync" como un reclamo creado por la API.
    graph_sync_status: "synced",
  };
  const doc = Object.assign(base, overrides);
  doc._id = doc.claim_id;
  doc.status_history = [
    {
      current_status: "created",
      actor_type: "customer",
      actor_id: doc.customer.customer_id,
      comment: "Reclamo registrado",
      event_at: now,
    },
  ];
  return doc;
}

// Entidades reutilizadas entre reclamos.
const customerJuan = { customer_id: "CUS-001", name: "Juan Perez", email: "juan.perez@email.com" };
const customerMaria = { customer_id: "CUS-002", name: "Maria Lopez", email: "maria.lopez@email.com" };
const customerCarlos = { customer_id: "CUS-003", name: "Carlos Ramirez", email: "carlos.ramirez@email.com" };

const productAudifonos = { product_id: "PRD-501", name: "Audifonos Bluetooth", category: "Tecnologia" };
const productZapatillas = { product_id: "PRD-502", name: "Zapatillas Running", category: "Calzado" };

const sellerTech = { seller_id: "SEL-010", name: "Tech Store Peru" };
const sellerDeportes = { seller_id: "SEL-020", name: "Deportes Lima" };

const carrierRapido = { carrier_id: "CAR-001", name: "Rapido Express" };
const carrierOlva = { carrier_id: "CAR-002", name: "Olva Courier" };

const zoneNorte = { zone_id: "ZON-lima-norte", name: "Lima Norte", region: "Lima" };
const zoneSur = { zone_id: "ZON-lima-sur", name: "Lima Sur", region: "Lima" };

const claims = [
  claimDoc({
    claim_id: "CLM-20260620-DEMOSEED01",
    claim_type: "late_delivery",
    channel: "mobile_app",
    priority: "high",
    customer: customerJuan,
    order: { order_id: "ORD-1001", purchase_date: "2026-06-20", amount: 349.90 },
    product: productAudifonos,
    seller: sellerTech,
    logistics: { carrier: carrierRapido, zone: zoneNorte, promised_date: "2026-06-19", tracking_code: "TRK-10001" },
    details: { description: "El pedido figura como entregado, pero no fue recibido." },
    evidence_summary: { count: 1, types: ["image"], last_uploaded_at: now },
  }),
  claimDoc({
    claim_id: "CLM-20260621-DEMOSEED02",
    claim_type: "defective_product",
    channel: "web",
    priority: "medium",
    customer: customerMaria,
    order: { order_id: "ORD-1010", purchase_date: "2026-06-21", amount: 349.90 },
    product: productAudifonos,
    seller: sellerTech,
    logistics: { carrier: carrierRapido, zone: zoneNorte, promised_date: "2026-06-21", tracking_code: "TRK-10002" },
    details: { description: "El audifono izquierdo no enciende." },
    evidence_summary: { count: 1, types: ["video"], last_uploaded_at: now },
  }),
  claimDoc({
    claim_id: "CLM-20260622-DEMOSEED03",
    claim_type: "incorrect_charge",
    channel: "call_center",
    priority: "high",
    customer: customerJuan,
    order: { order_id: "ORD-2001", purchase_date: "2026-06-22", amount: 159.90 },
    product: productZapatillas,
    seller: sellerDeportes,
    logistics: { carrier: carrierOlva, zone: zoneSur, promised_date: "2026-06-24", tracking_code: null },
    details: { description: "Se cobro dos veces el mismo pedido." },
    evidence_summary: { count: 1, types: ["receipt"], last_uploaded_at: now },
  }),
  claimDoc({
    claim_id: "CLM-20260623-DEMOSEED04",
    claim_type: "return_rejected",
    channel: "whatsapp",
    priority: "medium",
    customer: customerCarlos,
    order: { order_id: "ORD-2010", purchase_date: "2026-06-23", amount: 179.90 },
    product: productZapatillas,
    seller: sellerDeportes,
    logistics: { carrier: carrierOlva, zone: zoneSur, promised_date: "2026-06-25", tracking_code: null },
    details: { description: "La devolucion fue rechazada sin justificacion clara." },
    evidence_summary: { count: 2, types: ["audio", "document"], last_uploaded_at: now },
  }),
  claimDoc({
    claim_id: "CLM-20260624-DEMOSEED05",
    claim_type: "customer_service",
    channel: "whatsapp",
    priority: "low",
    customer: customerMaria,
    order: { order_id: "ORD-1020", purchase_date: "2026-06-24", amount: 349.90 },
    product: productAudifonos,
    seller: sellerTech,
    // Sin logistics: caso valido de reclamo de atencion al cliente sin logistica involucrada.
    details: { description: "El agente no dio seguimiento al caso anterior." },
    evidence_summary: { count: 1, types: ["conversation"], last_uploaded_at: now },
  }),
];

db.claims.insertMany(claims);

const attachments = [
  { attachment_id: "ATT-DEMOSEED01", claim_id: "CLM-20260620-DEMOSEED01", type: "image", url: "https://example.com/evidence/clm-demoseed01/photo1.jpg", description: "Foto de la puerta sin el paquete" },
  { attachment_id: "ATT-DEMOSEED02", claim_id: "CLM-20260621-DEMOSEED02", type: "video", url: "https://example.com/evidence/clm-demoseed02/video1.mp4", description: "Video mostrando que el audifono no enciende" },
  { attachment_id: "ATT-DEMOSEED03", claim_id: "CLM-20260622-DEMOSEED03", type: "receipt", url: "https://example.com/evidence/clm-demoseed03/boleta.pdf", description: "Boleta con el cobro duplicado" },
  { attachment_id: "ATT-DEMOSEED04A", claim_id: "CLM-20260623-DEMOSEED04", type: "audio", url: "https://example.com/evidence/clm-demoseed04/llamada.mp3", description: "Grabacion de la llamada con el agente" },
  { attachment_id: "ATT-DEMOSEED04B", claim_id: "CLM-20260623-DEMOSEED04", type: "document", url: "https://example.com/evidence/clm-demoseed04/politica_devolucion.pdf", description: "Politica de devolucion citada por el cliente" },
  { attachment_id: "ATT-DEMOSEED05", claim_id: "CLM-20260624-DEMOSEED05", type: "conversation", url: "https://example.com/evidence/clm-demoseed05/chat.json", description: "Transcripcion del chat de WhatsApp" },
].map((a) => Object.assign(a, { _id: a.attachment_id, uploaded_at: now }));

db.claim_attachments.insertMany(attachments);

// Nota: la forma de estos documentos espeja exactamente lo que producen
// upsert_customer_summary/upsert_product_summary/upsert_seller_summary
// (repositories/*.py) — sin campos extra que el codigo real nunca escribe
// (ej. closed_claims o sla_breaches no se incrementan en ningun lado hoy) y
// sin que falten los que si mantiene (created_at/updated_at).
db.customers.insertMany([
  {
    _id: "CUS-001",
    customer_id: "CUS-001",
    name: "Juan Perez",
    email: "juan.perez@email.com",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 2, open_claims: 2, last_claim_at: now },
    recent_claims: [
      { claim_id: "CLM-20260620-DEMOSEED01", claim_type: "late_delivery", current_status: "created", created_at: now },
      { claim_id: "CLM-20260622-DEMOSEED03", claim_type: "incorrect_charge", current_status: "created", created_at: now },
    ],
  },
  {
    _id: "CUS-002",
    customer_id: "CUS-002",
    name: "Maria Lopez",
    email: "maria.lopez@email.com",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 2, open_claims: 2, last_claim_at: now },
    recent_claims: [
      { claim_id: "CLM-20260621-DEMOSEED02", claim_type: "defective_product", current_status: "created", created_at: now },
      { claim_id: "CLM-20260624-DEMOSEED05", claim_type: "customer_service", current_status: "created", created_at: now },
    ],
  },
  {
    _id: "CUS-003",
    customer_id: "CUS-003",
    name: "Carlos Ramirez",
    email: "carlos.ramirez@email.com",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 1, open_claims: 1, last_claim_at: now },
    recent_claims: [
      { claim_id: "CLM-20260623-DEMOSEED04", claim_type: "return_rejected", current_status: "created", created_at: now },
    ],
  },
]);

db.products.insertMany([
  {
    _id: "PRD-501",
    product_id: "PRD-501",
    name: "Audifonos Bluetooth",
    category: "Tecnologia",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 3, open_claims: 3, last_claim_at: now },
    monthly_stats: [{ month: month, claims_created: 3 }],
  },
  {
    _id: "PRD-502",
    product_id: "PRD-502",
    name: "Zapatillas Running",
    category: "Calzado",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 2, open_claims: 2, last_claim_at: now },
    monthly_stats: [{ month: month, claims_created: 2 }],
  },
]);

db.sellers.insertMany([
  {
    _id: "SEL-010",
    seller_id: "SEL-010",
    name: "Tech Store Peru",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 3, open_claims: 3, last_claim_at: now },
    monthly_stats: [{ month: month, claims_created: 3 }],
  },
  {
    _id: "SEL-020",
    seller_id: "SEL-020",
    name: "Deportes Lima",
    created_at: now,
    updated_at: now,
    claim_summary: { total_claims: 2, open_claims: 2, last_claim_at: now },
    monthly_stats: [{ month: month, claims_created: 2 }],
  },
]);
