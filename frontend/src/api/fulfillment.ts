/**
 * Fulfillment API client — Person B.
 * Uses the repo's existing ApiClient for JWT auth.
 */
import { ApiClient } from './client';

// === Types ===

export interface SplitItem {
  product_id: number;
  product_name: string;
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  is_backorder: boolean;
  estimated_cost: number;
}

export interface SplitSuggestionResponse {
  splits: SplitItem[];
  total_shipments: number;
  total_estimated_cost: number;
  has_backorders: boolean;
  backorder_consolidation_available: boolean;
}

export interface AcceptSplitResponse {
  message: string;
  splits_created: number;
  has_backorders: boolean;
}

export interface ManualAllocation {
  product_id: number;
  warehouse_id: number;
  quantity: number;
  is_backorder?: boolean;
}

export interface OverrideSplitResponse {
  message: string;
  splits_created: number;
}

// === API Functions ===

export function suggestSplit(quotationId: number) {
  return ApiClient.post<SplitSuggestionResponse>(
    `/fulfillment/${quotationId}/suggest-split/`
  );
}

export function acceptSplit(quotationId: number) {
  return ApiClient.post<AcceptSplitResponse>(
    `/fulfillment/${quotationId}/accept-split/`
  );
}

export function overrideSplit(quotationId: number, allocations: ManualAllocation[]) {
  return ApiClient.post<OverrideSplitResponse>(
    `/fulfillment/${quotationId}/override-split/`,
    { allocations }
  );
}
