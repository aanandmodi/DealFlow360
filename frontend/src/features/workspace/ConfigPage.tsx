import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, X, Save, Database } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { PageHead, Notice, Loading, Empty } from './shared';

import { useAuth } from '../../context/AuthContext';

type Field = { name: string; type: string; readonly: boolean; required: boolean; default: unknown; options: {value: string | number; label: string}[] };
type ConfigData = { fields: Field[]; results: Record<string, any>[]; can_write: boolean };
const resources = [['users','Team access'],['products','Products'],['customers','Customers'],['variants','Variants'],['price-lists','Price lists'],['prices','Tier pricing'],['discounts','Discount policy'],['approvals','Approval chains'],['warehouses','Warehouses'],['stock','Inventory'],['plans','Recurring plans'],['upsell','Cross-sell rules']];
const label = (s: string) => s.replaceAll('_', ' ').replace('pct', '%');

export function ConfigPage() {
  const {user}=useAuth();
  const [resource, setResource] = useState('products');
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const query = useQuery({queryKey:['config',resource], queryFn:() => ApiClient.get<ConfigData>(`/config/${resource}/`)});
  const save = useMutation({mutationFn:() => form?.id ? ApiClient.patch(`/config/${resource}/${form.id}/`, form) : ApiClient.post(`/config/${resource}/`, form),
    onSuccess:() => { setForm(null); qc.invalidateQueries(); }});
  const fields = query.data?.fields || [];
  const rows = (query.data?.results || []).filter(r => Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()));
  const shown = fields.filter(f => !['description','address','is_subscription'].includes(f.name)).slice(0, 7);
  return <div className="workspace-page"><PageHead eyebrow="CONTROL CENTRE" title="Built around your business." description="Manage the catalog, pricing guardrails, inventory and recurring plans."/>
    <div className="config-layout"><nav className="config-nav" aria-label="Configuration areas">{resources.filter(([key])=>key!=='users'||user?.role==='admin').map(([key,name]) => <button key={key} className={resource===key?'active':''} onClick={() => {setResource(key);setForm(null);save.reset();setSearch('');}}>{name}<span>↗</span></button>)}</nav>
    <section className="panel config-content"><div className="panel-head"><div><div className="eyebrow">WORKSPACE CONFIGURATION</div><h2>{resources.find(r=>r[0]===resource)?.[1]}</h2></div>{query.data?.can_write && resource !== 'users' && <button className="btn btn-primary" onClick={() => {save.reset();setForm(Object.fromEntries(fields.filter(f=>!f.readonly).map(f=>[f.name, f.default])));}}><Plus size={16}/>Add record</button>}</div>
    <div className="table-toolbar"><input aria-label="Search records" placeholder="Search records…" value={search} onChange={e=>setSearch(e.target.value)}/><span>{rows.length} records · INR</span></div>
    <Notice error={query.error}/>{query.isLoading?<Loading/>:rows.length===0?<Empty/>:<div className="table-scroll"><table className="data-table"><thead><tr>{shown.map(f=><th key={f.name}>{label(f.name)}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>{shown.map(f=><td key={f.name}>{f.type==='checkbox'?<span className={`pill ${row[f.name]?'pill-green':''}`}>{row[f.name]?'Yes':'No'}</span>: f.options.find(o=>String(o.value)===String(row[f.name]))?.label || String(row[f.name]??'—')}</td>)}<td>{query.data?.can_write && <button className="icon-button" aria-label={`Edit ${row.name||row.id}`} onClick={()=>{setForm({...row});save.reset();}}><Pencil size={15}/></button>}</td></tr>)}</tbody></table></div>}
    <div className="panel-foot"><Database size={14}/>Changes are saved to your database and used by the deal engine.</div></section></div>
    {form && <div className="modal-backdrop"><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="panel-head"><h2 id="edit-title">{form.id?'Edit':'Add'} record</h2><button className="icon-button" aria-label="Close editor" onClick={()=>setForm(null)}><X/></button></div><form onSubmit={e=>{e.preventDefault();save.mutate();}}><div className="form-grid">{fields.filter(f=>!f.readonly).map(f=><label className={f.type==='checkbox'?'check-label':''} key={f.name}><span>{label(f.name)}{f.required?' *':''}</span>{f.type==='select'?<select required={f.required} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})}><option value="">Choose…</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>: f.type==='checkbox'?<input type="checkbox" checked={!!form[f.name]} onChange={e=>setForm({...form,[f.name]:e.target.checked})}/>:<input required={f.required} type={f.type} step={f.type==='number'?'0.01':undefined} min={f.type==='number'?0:undefined} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})}/>}</label>)}</div><Notice error={save.error}/><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setForm(null)}>Cancel</button><button disabled={save.isPending} className="btn btn-primary"><Save size={16}/>{save.isPending?'Saving…':'Save changes'}</button></div></form></section></div>}
  </div>;
}
