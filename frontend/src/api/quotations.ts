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

export function fetchQuotations(params?: Record<string, string>) {
  return apiClient<{ results: Quotation[]; count: number }>('/quotations/', { params });
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

export function fetchDiscountTiers() {
  return apiClient<{ results: { id: number; tier_key: string; name: string; max_discount_percent: string }[] }>(
    '/quotations/discount-tiers/'
  );
}

export function fetchProducts(params?: Record<string, string>) {
  return apiClient<{ results: Product[] }>(
    '/products/', { params }
  );
}

export function fetchCustomers(params?: Record<string, string>) {
  return apiClient<{ results: Customer[] }>(
    '/customers/', { params }
  );
}

// === Person C Object-style API ===

export const quotationsApi = {
  list: (params?: { status?: string; rep?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.rep) query.set('rep', params.rep);
    const qs = query.toString();
    return ApiClient.get<QuotationListItem[]>(`/quotations/${qs ? `?${qs}` : ''}`);
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
