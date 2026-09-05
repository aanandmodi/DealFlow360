import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, LayoutGrid, List, ArrowUpRight, Clock } from 'lucide-react';
import { quotationsApi } from '../../api/quotations';
import { formatCurrency, getStatusLabel, timeAgo } from '../../lib/utils';
import { PageHead, NewQuote, Notice, Empty, Loading } from './shared';

export function DealsPage({approvals=false}:{approvals?:boolean}) {
  const [params]=useSearchParams();
  const [search,setSearch]=useState(params.get('search')||'');
  const [status,setStatus]=useState(approvals?'pending_approval':params.get('status')||'');
  useEffect(()=>{setSearch(params.get('search')||'');setStatus(approvals?'pending_approval':params.get('status')||'');},[params,approvals]);
  const [board,setBoard]=useState(!approvals);
  const query=useQuery({queryKey:['quotations'],queryFn:()=>quotationsApi.list(),refetchInterval:15000});
  const quotes=(query.data||[]).filter(q=>(!status||q.status===status)&&`${q.customer_name} ${q.quote_number} ${q.rep_name}`.toLowerCase().includes(search.toLowerCase()));
  const stages=['draft','pending_approval','approved','sent','under_negotiation','confirmed','fulfillment','invoiced','paid','rejected','cancelled'].filter(s=>!status||s===status);
  const visible=stages.filter(s=>['draft','pending_approval','approved','sent','confirmed'].includes(s)||quotes.some(q=>q.status===s));
  const path=(id:number)=>`${approvals?'/approvals':'/quotations'}/${id}`;
  return <div className="workspace-page"><PageHead eyebrow={approvals?'PRICING GOVERNANCE':'DEAL WORKSPACE'} title={approvals?'Decisions that protect value.':'From possibility to partnership.'} description={approvals?'Review exceptions, understand the margin and keep the right deals moving.':'Your active deals, organised around the next step.'}>{!approvals&&<NewQuote/>}</PageHead>
    <div className="deals-toolbar"><div className="search-field"><Search size={17}/><input aria-label="Search quotations" placeholder="Search customer, quotation or representative…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Filter stage" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All stages</option>{['draft','pending_approval','approved','sent','under_negotiation','confirmed','fulfillment','invoiced','paid','rejected'].map(s=><option value={s} key={s}>{getStatusLabel(s)}</option>)}</select><div className="view-toggle"><button aria-label="Board view" className={board?'active':''} onClick={()=>setBoard(true)}><LayoutGrid size={17}/></button><button aria-label="List view" className={!board?'active':''} onClick={()=>setBoard(false)}><List size={17}/></button></div></div>
    <Notice error={query.error}/>{query.isLoading?<Loading/>:!quotes.length?<Empty title="No quotations found" text="Try another filter or create a quotation to get started."/>:board?<div className="kanban-board">{visible.map(stage=>{const list=quotes.filter(q=>q.status===stage);return <section className="kanban-column" key={stage}><div className="kanban-heading"><span className={`stage-dot stage-${stage}`}/><h2>{getStatusLabel(stage)}</h2><span>{list.length}</span></div><div className="kanban-total">{formatCurrency(list.reduce((s,q)=>s+Number(q.total_amount),0))}</div>{list.map(q=><Link to={path(q.id)} className="deal-card" key={q.id}><div className="deal-card-top"><span className="eyebrow">{q.quote_number}</span><ArrowUpRight size={16}/></div><h3>{q.customer_name}</h3><span className="muted">{q.customer_tier} customer</span><strong className="deal-value">{formatCurrency(q.total_amount)}</strong><div className="deal-card-bottom"><span className="mini-avatar">{q.rep_name.slice(0,1)}</span><span>{q.rep_name}</span><span>{q.margin_pct}% margin</span></div><div className="deal-age"><Clock size={12}/>{timeAgo(q.updated_at)}</div></Link>)}{!list.length&&<div className="kanban-empty">No deals in this stage</div>}</section>;})}</div>:<section className="panel table-scroll"><table className="data-table"><thead><tr><th>Customer / Quotation</th><th>Stage</th><th>Net amount</th><th>Margin</th><th>Representative</th><th/></tr></thead><tbody>{quotes.map(q=><tr key={q.id}><td><Link to={path(q.id)}><strong>{q.customer_name}</strong><small>{q.quote_number}</small></Link></td><td><span className="pill">{getStatusLabel(q.status)}</span></td><td>{formatCurrency(q.total_amount)}</td><td>{q.margin_pct}%</td><td>{q.rep_name}</td><td><Link to={path(q.id)}><ArrowUpRight size={16}/></Link></td></tr>)}</tbody></table></section>}
  </div>;
}
