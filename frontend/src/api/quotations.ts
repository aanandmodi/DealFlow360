/**
 * Quotations API — all quotation-related API calls.
 */

import { apiClient } from './client';
import type {
  Quotation, QuotationLine, QuotationCreate,
  QuotationLineCreate, RiskScoreResult, ApprovalLog,
  SubmitResult, ApproveResult,
} from '../types';

// === Quotation CRUD ===

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

// === Line Items ===

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

// === State Machine Actions ===

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

// === Risk Score ===

export function fetchRiskScore(id: number) {
  return apiClient<RiskScoreResult>(`/quotations/${id}/risk-score/`);
}

// === Approval Logs ===

export function fetchApprovalLogs(quotationId: number) {
  return apiClient<ApprovalLog[]>(`/quotations/${quotationId}/logs/`);
}

// === Config ===

export function fetchDiscountTiers() {
  return apiClient<{ results: { id: number; tier_key: string; name: string; max_discount_percent: string }[] }>(
    '/quotations/discount-tiers/'
  );
}

export function fetchProducts(params?: Record<string, string>) {
  return apiClient<{ results: { id: number; name: string; sku: string; category: number; category_name: string; base_price: string; unit: string; tax_rate: string; is_subscription: boolean }[] }>(
    '/auth/products/', { params }
  );
}

export function fetchCustomers(params?: Record<string, string>) {
  return apiClient<{ results: { id: number; name: string; company: string; email: string; tier: string; tier_display: string }[] }>(
    '/auth/customers/', { params }
  );
}
