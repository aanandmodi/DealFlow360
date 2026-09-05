import { ApiClient } from './client';

export interface ValidatedBulkRow {
  row_index: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  customer_name: string;
  customer_email: string;
  resolved_customer: string;
  customer_id?: number | null;
  sku: string;
  product_name: string;
  product_id?: number | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  stock_available?: number | null;
  payment_terms?: string;
  notes?: string;
  requires_approval: boolean;
  warnings: string[];
  errors: string[];
}

export interface BulkValidationResponse {
  success: boolean;
  total_rows: number;
  valid_count: number;
  warning_count: number;
  error_count: number;
  total_value: number;
  rows: ValidatedBulkRow[];
  error?: string;
}

export interface BulkCommitResponse {
  success: boolean;
  message: string;
  quotations: {
    id: number;
    quote_number: string;
    customer_name: string;
    total: number;
    line_count: number;
    status: string;
    required_approval?: string;
  }[];
  total_lines: number;
  error?: string;
}

export const bulkApi = {
  validate: (csvTextOrRows: string | any[]): Promise<BulkValidationResponse> => {
    const payload = typeof csvTextOrRows === 'string'
      ? { action: 'validate', csv_text: csvTextOrRows }
      : { action: 'validate', rows: csvTextOrRows };
    return ApiClient.post<BulkValidationResponse>('/quotations/bulk-import/', payload);
  },

  commit: (rows: ValidatedBulkRow[], targetQuotationId?: number): Promise<BulkCommitResponse> => {
    return ApiClient.post<BulkCommitResponse>('/quotations/bulk-import/', {
      action: 'commit',
      rows,
      target_quotation_id: targetQuotationId,
    });
  },

  downloadTemplate: async () => {
    const blob = await ApiClient.download('/quotations/bulk-template/');
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dealflow360_bulk_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
