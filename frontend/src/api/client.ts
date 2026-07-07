import type {
  ApiMessage,
  Attachment,
  ClaimCreate,
  ClaimDocument,
  ClaimSearchFilters,
  CustomerSummaryDoc,
  OperationalSummary,
  OutboxEvent,
  ProductSummaryDoc,
  RecurringEntity,
  RelatedClaimsResponse,
  SellerSummaryDoc,
  SearchClaimsResponse,
  StatusUpdate,
} from "../types/domain";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      // sin cuerpo JSON, se usa statusText
    }
    throw new Error(`${res.status} ${detail}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// Reclamos
export function createClaim(payload: ClaimCreate) {
  return request<ApiMessage>("/api/v1/claims", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function searchClaims(filters: ClaimSearchFilters) {
  return request<SearchClaimsResponse>(`/api/v1/claims${buildQuery(filters)}`);
}

export function getClaim(claimId: string) {
  return request<ClaimDocument>(`/api/v1/claims/${claimId}`);
}

export function getClaimAttachments(claimId: string) {
  return request<{ claim_id: string; attachments: Attachment[] }>(`/api/v1/claims/${claimId}/attachments`);
}

export function updateClaimStatus(claimId: string, payload: StatusUpdate) {
  return request<ApiMessage>(`/api/v1/claims/${claimId}/status`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getRelatedClaims(claimId: string, maxHops: number, limit: number) {
  return request<RelatedClaimsResponse>(
    `/api/v1/claims/${claimId}/related${buildQuery({ max_hops: maxHops, limit })}`
  );
}

// Analitica
export function getOperationalSummary() {
  return request<OperationalSummary>("/api/v1/analytics/operational-summary");
}

export function getCustomersSummary(limit = 10) {
  return request<{ customers: CustomerSummaryDoc[] }>(
    `/api/v1/analytics/customers-summary${buildQuery({ limit })}`
  );
}

export function getProductsAtRisk(limit = 10) {
  return request<{ products: ProductSummaryDoc[] }>(
    `/api/v1/analytics/products-at-risk${buildQuery({ limit })}`
  );
}

export function getSellersAtRisk(limit = 10) {
  return request<{ sellers: SellerSummaryDoc[] }>(
    `/api/v1/analytics/sellers-at-risk${buildQuery({ limit })}`
  );
}

export function getRecurringIncidents(limit = 10) {
  return request<{ entities: RecurringEntity[] }>(
    `/api/v1/analytics/recurring-incidents${buildQuery({ limit })}`
  );
}

export function getOutboxEvents(status?: string, limit = 20) {
  return request<{ events: OutboxEvent[] }>(
    `/api/v1/analytics/outbox${buildQuery({ status, limit })}`
  );
}

export function getHealth() {
  return request<{ status: string; servicio: string; mongo: string; neo4j: string }>("/health");
}
