import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, ArrowUpRight } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { formatCurrency, getStatusLabel } from '../../lib/utils';
import { PageHead, Notice, Loading, Empty, Stat, downloadFile } from './shared';

export type Report = {rows: {id:number;quote_number:string;customer:string;rep:string;status:string;amount:number;discount:number;margin:number;created:string}[];stages:Record<string,number>;summary:{count:number;pipeline:number;bookings:number;win_rate:number;discount:number;margin:number}};
export function ReportsPage() {
  const [filters,setFilters] = useState({from:'',to:'',status:'',category:'',rep:''});
  const [error,setError] = useState<unknown>();
  const params = new URLSearchParams(Object.entries(filters).filter(([,v])=>v)).toString();
  const query = useQuery({queryKey:['reports',params],queryFn:()=>ApiClient.get<Report>(`/reports/?${params}`)});
  const users = useQuery({queryKey:['report-reps'],queryFn:()=>ApiClient.get<{id:number;first_name:string;last_name:string;username:string}[]>('/auth/users/?role=sales_rep'),retry:false});
  const s=query.data?.summary;
  return <div className="workspace-page"><PageHead eyebrow="REVENUE INTELLIGENCE" title="Every number, connected." description="Explore the pipeline, signed business and pricing discipline in one place."><button className="btn btn-secondary" onClick={()=>downloadFile(`/reports/?${params}&export=csv`,'dealflow-report.csv').catch(setError)}><Download size={16}/>Export CSV</button><button className="btn btn-secondary" onClick={()=>downloadFile(`/reports/?${params}&export=xlsx`,'dealflow-report.xlsx').catch(setError)}>Export Excel</button><button className="btn btn-secondary" onClick={()=>downloadFile(`/reports/?${params}&export=pdf`,'dealflow-report.pdf').catch(setError)}>Download PDF</button></PageHead>
  <div className="filter-bar"><label>From<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>To<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label><label>Stage<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All stages</option>{['draft','pending_approval','approved','sent','under_negotiation','confirmed','fulfillment','paid','rejected'].map(s=><option key={s} value={s}>{getStatusLabel(s)}</option>)}</select></label><label>Category<select value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">All categories</option>{['hardware','services','software','subscriptions'].map(s=><option key={s}>{s}</option>)}</select></label>{users.data && <label>Representative<select value={filters.rep} onChange={e=>setFilters({...filters,rep:e.target.value})}><option value="">All representatives</option>{users.data.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name || u.username}</option>)}</select></label>}</div>
  <Notice error={query.error||error}/>{query.isLoading?<Loading/>:s&&<><div className="metrics-grid"><Stat label="Active pipeline" value={formatCurrency(s.pipeline)} note="Open quotations, excluding tax" accent/><Stat label="Confirmed bookings" value={formatCurrency(s.bookings)} note="Customer-confirmed net order value"/><Stat label="Closed-deal win rate" value={`${s.win_rate}%`} note="Confirmed / confirmed + lost"/><Stat label="Average gross margin" value={`${s.margin}%`} note="Based on configured product costs"/></div>
  <section className="panel"><div className="panel-head"><h2>Deal performance</h2><span className="muted">{s.count} matching quotations</span></div>{query.data!.rows.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Quotation / Customer</th><th>Representative</th><th>Stage</th><th>Net amount</th><th>Margin</th><th>Created</th></tr></thead><tbody>{query.data!.rows.map(r=><tr key={r.id}><td><Link to={`/quotations/${r.id}`}><strong>{r.customer}</strong><small>{r.quote_number} <ArrowUpRight size={12}/></small></Link></td><td>{r.rep}</td><td><span className={`pill ${['paid','confirmed','approved'].includes(r.status)?'pill-green':''}`}>{getStatusLabel(r.status)}</span></td><td className="numeric">{formatCurrency(r.amount)}</td><td>{r.margin}%</td><td>{r.created}</td></tr>)}</tbody></table></div>:<Empty title="No matching deals" text="Adjust your filters to see more of your pipeline."/>}</section></>}
  </div>;
}

