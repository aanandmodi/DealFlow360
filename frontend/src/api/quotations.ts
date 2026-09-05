/**
 * Quotations API — Unified client supporting Person A (CPQ & Approvals) and Person C (Pipeline & Analytics).
 */
import { ApiClient, apiClient } from './client';
import type {
  Quotation, QuotationLine, QuotationCreate,
  QuotationLineCreate, RiskScoreResult, ApprovalLog,
  SubmitResult, ApproveResult, PipelineSummary,
  QuotationListItem, Customer, Product,
} from '../types';

export type {
  Quotation, QuotationLine, QuotationCreate,
  QuotationLineCreate, RiskScoreResult, ApprovalLog,
  SubmitResult, ApproveResult, PipelineSummary,
  QuotationListItem, Customer, Product,
};

// === Quotation CRUD (Person A) ===

export async function fetchQuotations(params?: Record<string, string>): Promise<{ results: Quotation[]; count: number }> {
  const res = await apiClient<any>('/quotations/', { params });
  if (Array.isArray(res)) {
    return { results: res, count: res.length };
  }
  return { results: res?.results || [], count: res?.count ?? (res?.results?.length || 0) };
}

export function fetchQuotation(id: number) {
  return apiClient<Quotation>(`/quotations/${id}/`);
}

export function createQuotation(data: QuotationCreate) {
  return apiClient<Quotation>('/quotations/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateQuotation(id: number, data: Partial<QuotationCreate>) {
  return apiClient<Quotation>(`/quotations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteQuotation(id: number) {
  return apiClient(`/quotations/${id}/`, { method: 'DELETE' });
}

// === Line Items (Person A) ===

export function addLine(quotationId: number, data: QuotationLineCreate) {
  return apiClient<QuotationLine>(`/quotations/${quotationId}/lines/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateLine(quotationId: number, lineId: number, data: Partial<QuotationLineCreate>) {
  return apiClient<QuotationLine>(`/quotations/${quotationId}/lines/${lineId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteLine(quotationId: number, lineId: number) {
  return apiClient(`/quotations/${quotationId}/lines/${lineId}/`, { method: 'DELETE' });
}

// === State Machine Actions (Person A) ===

export function submitQuotation(id: number) {
  return apiClient<SubmitResult>(`/quotations/${id}/submit/`, { method: 'POST' });
}

export function approveQuotation(id: number, reason?: string) {
  return apiClient<ApproveResult>(`/quotations/${id}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function rejectQuotation(id: number, reason?: string) {
  return apiClient(`/quotations/${id}/reject/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function returnQuotation(id: number, reason?: string) {
  return apiClient(`/quotations/${id}/return/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function confirmQuotation(id: number) {
  return apiClient(`/quotations/${id}/confirm/`, { method: 'POST' });
}

// === Risk Score (Person A) ===

export function fetchRiskScore(id: number) {
  return apiClient<RiskScoreResult>(`/quotations/${id}/risk-score/`);
}

// === Approval Logs (Person A) ===

export function fetchApprovalLogs(quotationId: number) {
  return apiClient<ApprovalLog[]>(`/quotations/${quotationId}/logs/`);
}

// === Config & Catalogs ===

export async function fetchDiscountTiers(): Promise<{ results: { id: number; tier_key: string; name: string; max_discount_percent: string }[] }> {
  const res = await apiClient<any>('/quotations/discount-tiers/');
  const list = Array.isArray(res) ? res : (res?.results || []);
  return { results: list };
}

export async function fetchProducts(params?: Record<string, string>): Promise<{ results: Product[] }> {
  const res = await apiClient<any>('/products/', { params });
  const list = Array.isArray(res) ? res : (res?.results || []);
  return { results: list };
}

export async function fetchCustomers(params?: Record<string, string>): Promise<{ results: Customer[] }> {
  const res = await apiClient<any>('/customers/', { params });
  const list = Array.isArray(res) ? res : (res?.results || []);
  return { results: list };
}

// === Person C Object-style API ===

export const quotationsApi = {
  list: async (params?: { status?: string; rep?: string }): Promise<QuotationListItem[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.rep) query.set('rep', params.rep);
    const qs = query.toString();
    // Backend returns paginated response; handle both paginated and array
    const raw = await ApiClient.get<any>(`/quotations/${qs ? `?${qs}` : ''}`);
    const items = Array.isArray(raw) ? raw : (raw?.results || []);
    // Transform string decimals to numbers for frontend compatibility
    return items.map((q: any) => ({
      ...q,
      blended_risk_score: parseFloat(q.blended_risk_score) || 0,
      total_amount: parseFloat(q.total_amount || q.total) || 0,
      margin_pct: parseFloat(q.margin_pct || q.blended_margin_percent) || 0,
      quote_number: q.quote_number || `Q-${q.id}`,
      rep_name: q.rep_name || q.sales_rep_name || 'Unassigned',
      customer_company: q.customer_company || '',
    }));
  },

  detail: (id: number) => ApiClient.get<Quotation>(`/quotations/${id}/`),

  create: (data: { customer_id: number; notes?: string }) =>
    ApiClient.post<Quotation>('/quotations/create/', data),

  submit: (id: number) => ApiClient.post<Quotation>(`/quotations/${id}/submit/`),

  pipelineSummary: async (): Promise<PipelineSummary> => {
    // Use the existing dashboard summary endpoint
    const summary = await ApiClient.get<any>('/dashboard/summary/');
    return {
      total_quotations: (summary.active_pipeline_count || 0) + (summary.closed_won_count || 0),
      active_pipeline_value: summary.active_pipeline_value || 0,
      active_pipeline_count: summary.active_pipeline_count || 0,
      pending_approvals: summary.pending_approvals || 0,
      at_risk_count: summary.at_risk_count || 0,
      closed_won_value: summary.closed_won_value || 0,
      closed_won_count: summary.closed_won_count || 0,
      pipeline_by_status: {},
    };
  },

  customers: () => ApiClient.get<Customer[]>('/customers/'),

  products: (category?: string) =>
    ApiClient.get<Product[]>(`/products/${category ? `?category=${category}` : ''}`),
};

