/**
 * Dashboard API — stalled deals, anomalies, KPI summary.
 */
import { ApiClient } from './client';

export interface DashboardSummary {
  active_pipeline_value: number;
  active_pipeline_count: number;
  pending_approvals: number;
  at_risk_count: number;
  avg_margin_pct: number;
  stalled_count: number;
  anomaly_count: number;
  slippage_count: number;
  closed_won_value: number;
  closed_won_count: number;
}

export interface StalledDeal {
  quotation_id: number;
  quote_number: string;
  customer_name: string;
  customer_company: string;
  rep_name: string;
  rep_id: number;
  status: string;
  total_amount: number;
  days_idle: number;
  last_activity: string;
  severity: 'high' | 'medium';
}

export interface DiscountAnomaly {
  quotation_id: number;
  quote_number: string;
  customer_name: string;
  rep_name: string;
  rep_id: number;
  product_name: string;
  discount_given: number;
  rep_avg_discount: number;
  over_average: number;
  total_amount: number;
  issue: string;
  severity: 'high' | 'medium';
}

export interface DeliverySlippage {
  quotation_id: number;
  quote_number: string;
  customer_name: string;
  warehouse_name: string;
  product_name: string;
  promised_date: string;
  days_late: number;
  qty: number;
  severity: 'high' | 'medium';
}

export const dashboardApi = {
  summary: () => ApiClient.get<DashboardSummary>('/dashboard/summary/'),

  stalledDeals: (thresholdDays?: number) => {
    const params = thresholdDays ? `?threshold_days=${thresholdDays}` : '';
    return ApiClient.get<StalledDeal[]>(`/dashboard/stalled-deals/${params}`);
  },

  anomalies: (thresholdPct?: number) => {
    const params = thresholdPct ? `?threshold_pct=${thresholdPct}` : '';
    return ApiClient.get<DiscountAnomaly[]>(`/dashboard/anomalies/${params}`);
  },

  slippage: () => ApiClient.get<DeliverySlippage[]>('/dashboard/slippage/'),
};
