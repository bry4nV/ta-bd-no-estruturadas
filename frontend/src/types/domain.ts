export type ClaimType =
  | "defective_product"
  | "late_delivery"
  | "incomplete_delivery"
  | "incorrect_charge"
  | "return_rejected"
  | "warranty_not_honored"
  | "customer_service";

export type Channel = "web" | "mobile_app" | "store" | "whatsapp" | "call_center" | "email";

export type Priority = "low" | "medium" | "high";

export type ClaimStatus = "created" | "in_review" | "pending_customer" | "resolved" | "closed" | "rejected";

export type EvidenceType = "image" | "video" | "audio" | "document" | "receipt" | "conversation";

export interface Customer {
  customer_id: string;
  name: string;
  email?: string | null;
}

export interface Order {
  order_id: string;
  purchase_date?: string | null;
  amount?: number | null;
}

export interface Product {
  product_id: string;
  name: string;
  category?: string | null;
}

export interface Seller {
  seller_id: string;
  name: string;
}

export interface Carrier {
  carrier_id: string;
  name: string;
  zone?: string | null;
}

export interface Zone {
  zone_id?: string | null;
  name: string;
  region?: string | null;
}

export interface Logistics {
  carrier?: Carrier | null;
  zone?: Zone | null;
  promised_date?: string | null;
  tracking_code?: string | null;
}

export interface Evidence {
  type: EvidenceType;
  url: string;
  description?: string | null;
}

export interface ClaimCreate {
  claim_type: ClaimType;
  channel: Channel;
  priority: Priority;
  customer: Customer;
  order: Order;
  product: Product;
  seller: Seller;
  logistics?: Logistics | null;
  details: Record<string, unknown>;
  evidence: Evidence[];
}

export interface StatusUpdate {
  current_status: ClaimStatus;
  comment?: string | null;
  actor_id?: string | null;
}

export interface EvidenceSummary {
  count: number;
  types: EvidenceType[];
  last_uploaded_at?: string | null;
}

export interface Attachment {
  attachment_id: string;
  claim_id: string;
  type: EvidenceType;
  url: string;
  description?: string | null;
  uploaded_at: string;
}

export interface StatusHistoryEntry {
  current_status: ClaimStatus;
  actor_type: "customer" | "agent";
  actor_id?: string | null;
  comment?: string | null;
  event_at: string;
}

export interface Sla {
  due_at: string;
  breached: boolean;
}

export interface ClaimDocument {
  _id: string;
  claim_id: string;
  claim_type: ClaimType;
  channel: Channel;
  priority: Priority;
  current_status: ClaimStatus;
  created_at: string;
  updated_at: string;
  customer: Customer;
  order: Order;
  product: Product;
  seller: Seller;
  logistics: Logistics | null;
  details: Record<string, unknown>;
  evidence_summary: EvidenceSummary;
  status_history: StatusHistoryEntry[];
  sla: Sla;
  graph_sync_status: string;
}

export interface ApiMessage {
  claim_id: string;
  current_status: string;
  message: string;
}

export interface SearchClaimsResponse {
  total_coincidencias: number;
  total_mostrado: number;
  offset: number;
  claims: ClaimDocument[];
}

export interface ClaimSearchFilters {
  current_status?: string;
  claim_type?: string;
  customer_id?: string;
  product_id?: string;
  seller_id?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

export interface PathNode {
  kind: string;
  id: string;
  label: string;
  claim_type?: string | null;
}

export interface RelatedClaim {
  claim_id: string;
  claim_type?: string | null;
  current_status?: string | null;
  hops: number;
  motivo: string;
  entity_types: string[];
  shared_entities: string[];
  score: number;
  paths: PathNode[][];
}

export interface RelatedClaimsResponse {
  claim_id: string;
  related: RelatedClaim[];
}

export interface ClaimSummaryEntry {
  claim_id: string;
  claim_type: string;
  current_status: string;
  created_at: string;
}

export interface ClaimSummary {
  total_claims: number;
  open_claims: number;
  last_claim_at?: string | null;
}

export interface CustomerSummaryDoc {
  _id: string;
  customer_id: string;
  name: string;
  email?: string | null;
  claim_summary: ClaimSummary;
  recent_claims: ClaimSummaryEntry[];
}

export interface MonthlyStat {
  month: string;
  claims_created: number;
}

export interface ProductSummaryDoc {
  _id: string;
  product_id: string;
  name: string;
  category?: string | null;
  claim_summary: ClaimSummary;
  monthly_stats: MonthlyStat[];
}

export interface SellerSummaryDoc {
  _id: string;
  seller_id: string;
  name: string;
  claim_summary: ClaimSummary;
  monthly_stats: MonthlyStat[];
}

export interface CountByKey {
  total: number;
  [key: string]: unknown;
}

export interface RecurringEntity {
  entity_type: string;
  entity_id?: string;
  name?: string;
  total_claims?: number;
  [key: string]: unknown;
}

export interface OperationalSummary {
  total_claims: number;
  by_status: { current_status: string; total: number }[];
  by_claim_type: { claim_type: string; total: number }[];
  by_channel: { channel: string; total: number }[];
  top_products: { product_id: string; name: string; total: number }[];
  top_sellers: { seller_id: string; name: string; total: number }[];
  recurring_entities_neo4j: RecurringEntity[];
}

export interface OutboxEvent {
  _id: string;
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
  retry_count: number;
  created_at: string;
  processed_at?: string | null;
  last_error?: string | null;
  payload?: Record<string, unknown>;
}
