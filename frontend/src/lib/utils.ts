/**
 * Utility functions for DealFlow360.
 */
export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

export function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '0.0%' : `${num.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'badge-info',
    pending_approval: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    sent: 'badge-info',
    under_negotiation: 'badge-warning',
    confirmed: 'badge-success',
    cancelled: 'badge-danger',
    fulfillment: 'badge-info',
    invoiced: 'badge-info',
    paid: 'badge-success',
  };
  return map[status] || 'badge-info';
}

export function getRiskBadgeClass(score: string | number): string {
  const num = typeof score === 'string' ? parseFloat(score) : score;
  if (isNaN(num) || num === 0) return 'badge-approved';
  if (num < 5) return 'badge-pending';
  return 'badge-high-risk';
}

export function getRiskLabel(score: string | number): string {
  const num = typeof score === 'string' ? parseFloat(score) : score;
  if (isNaN(num) || num === 0) return 'IN POLICY';
  if (num < 2) return 'LOW RISK';
  if (num < 5) return 'MEDIUM RISK';
  return 'HIGH RISK';
}

export function getTierBadgeClass(tier: string): string {
  switch (tier?.toLowerCase()) {
    case 'gold': return 'badge-active';
    case 'silver': return 'badge-pending';
    case 'bronze': return 'badge-approved';
    default: return 'badge-active';
  }
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    sent: 'Sent',
    under_negotiation: 'Under Negotiation',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    fulfillment: 'Fulfillment',
    invoiced: 'Invoiced',
    paid: 'Paid',
  };
  return map[status] || status;
}

export function getTierColor(tier: string): string {
  const map: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
  };
  return map[tier] || '#94A3B8';
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
