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
    const res = await ApiClient.get<any>(`/quotations/${qs ? `?${qs}` : ''}`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.results)) return res.results;
    return [];
  },

  detail: (id: number) => ApiClient.get<Quotation>(`/quotations/${id}/`),

  create: (data: { customer_id: number; notes?: string }) =>
    ApiClient.post<Quotation>('/quotations/create/', data),

  submit: (id: number) => ApiClient.post<Quotation>(`/quotations/${id}/submit/`),

  pipelineSummary: () => ApiClient.get<PipelineSummary>('/quotations/pipeline-summary/'),

  customers: () => ApiClient.get<Customer[]>('/customers/'),

  products: (category?: string) =>
    ApiClient.get<Product[]>(`/products/${category ? `?category=${category}` : ''}`),
};
