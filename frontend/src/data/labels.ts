import type { Channel, ClaimStatus, ClaimType, EvidenceType, Priority } from "@/types/domain";

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  defective_product: "Producto defectuoso",
  late_delivery: "Entrega tardia",
  incomplete_delivery: "Entrega incompleta",
  incorrect_charge: "Cobro incorrecto",
  return_rejected: "Devolucion rechazada",
  warranty_not_honored: "Garantia no reconocida",
  customer_service: "Atencion al cliente",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  web: "Web",
  mobile_app: "App movil",
  store: "Tienda fisica",
  whatsapp: "WhatsApp",
  call_center: "Call center",
  email: "Email",
};

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  created: "Creado",
  in_review: "En revision",
  pending_customer: "Esperando cliente",
  resolved: "Resuelto",
  closed: "Cerrado",
  rejected: "Rechazado",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja (SLA 120h)",
  medium: "Media (SLA 72h)",
  high: "Alta (SLA 24h)",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  document: "Documento",
  receipt: "Boleta/Recibo",
  conversation: "Conversacion",
};

export const ENTITY_KIND_LABELS: Record<string, string> = {
  Claim: "Reclamo",
  Customer: "Cliente",
  Product: "Producto",
  Seller: "Vendedor",
  Carrier: "Operador logistico",
  Zone: "Zona",
};
