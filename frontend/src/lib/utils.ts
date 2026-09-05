import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toFixed(1)}%`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft': return 'badge-active';
    case 'pending_approval': return 'badge-pending';
    case 'approved': return 'badge-approved';
    case 'rejected': return 'badge-high-risk';
    case 'confirmed': return 'badge-approved';
    case 'under_negotiation': return 'badge-pending';
    default: return 'badge-active';
  }
}

export function getRiskBadgeClass(score: string | number): string {
  const num = typeof score === 'string' ? parseFloat(score) : score;
  if (num === 0) return 'badge-approved';
  if (num < 5) return 'badge-pending';
  return 'badge-high-risk';
}

export function getRiskLabel(score: string | number): string {
  const num = typeof score === 'string' ? parseFloat(score) : score;
  if (num === 0) return 'IN POLICY';
  if (num < 2) return 'LOW RISK';
  if (num < 5) return 'MEDIUM RISK';
  return 'HIGH RISK';
}

export function getTierBadgeClass(tier: string): string {
  switch (tier) {
    case 'gold': return 'badge-active';
    case 'silver': return 'badge-pending';
    case 'bronze': return 'badge-approved';
    default: return 'badge-active';
  }
}
