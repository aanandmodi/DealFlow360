import { ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../api/client';

export function errorText(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return Object.entries(error as Record<string, unknown>).map(([key, value]) => `${key === 'detail' ? '' : key + ': '}${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ');
}
export function Notice({ error, message }: { error?: unknown; message?: string }) {
  if (!error && !message) return null;
  return <div role={error ? 'alert' : 'status'} className={`notice ${error ? 'notice-error' : ''}`}><AlertCircle size={17}/>{errorText(error) || message}</div>;
}
export function PageHead({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{children}</div></div>;
}
export function Empty({ title = 'Nothing here yet', text = 'Your records will appear here as your team works.' }: { title?: string; text?: string }) {
  return <div className="empty-state"><div className="empty-symbol">↗</div><h3>{title}</h3><p>{text}</p></div>;
}
export function Loading() { return <div className="loading-state" role="status"><div className="loading-bar"/>Loading your workspace…</div>; }
export function NewQuote() { return <Link className="btn btn-primary" to="/quotations/new"><Plus size={16}/>Create quotation</Link>; }
export function Stat({ label, value, note, accent }: { label: string; value: ReactNode; note: string; accent?: boolean }) {
  return <article className={`metric ${accent ? 'metric-accent' : ''}`}><div className="metric-label">{label}<ArrowUpRight size={16}/></div><strong>{value}</strong><small>{note}</small></article>;
}
export async function downloadFile(endpoint: string, filename: string) {
  const blob = await ApiClient.download(endpoint);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
