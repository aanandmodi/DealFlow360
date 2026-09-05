import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '../../api/client';
import {formatDateTime} from '../../lib/utils';
import {Notice,Empty} from './shared';
export function DealConversation({id,status}:{id:number;status:string}){
 const qc=useQueryClient();const [message,setMessage]=useState('');
 const query=useQuery({queryKey:['conversation',id],queryFn:()=>ApiClient.get<{id:number;author_name:string;author_type:string;message:string;created_at:string}[]>(`/quotations/${id}/conversation/`),refetchInterval:15000});
 const send=useMutation({mutationFn:()=>ApiClient.post(`/quotations/${id}/conversation/`,{message}),onSuccess:()=>{setMessage('');qc.invalidateQueries();}});
 return <section className="panel"><div className="panel-head"><div><h2>Customer conversation</h2><p className="muted mt-1">Messages here are visible to the customer through their private quotation link.</p></div></div><Notice error={query.error||send.error}/><div className="divide-y divide-slate-100">{query.data?.length?query.data.map(m=><article key={m.id} className="px-6 py-4"><div className="flex gap-3 items-center"><strong className="text-xs">{m.author_name}</strong><span className="pill">{m.author_type==='rep'?'Sales team':m.author_type}</span><small className="text-slate-400 text-[11px] ml-auto">{formatDateTime(m.created_at)}</small></div><p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{m.message}</p></article>):<Empty title="No messages yet" text="Use this space to answer customer questions and clarify the proposal."/>}</div>{['draft','approved','sent','pending_approval','under_negotiation'].includes(status)&&<form className="p-5 border-t border-slate-200" onSubmit={e=>{e.preventDefault();send.mutate();}}><label>Reply to customer<textarea required maxLength={5000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Explain the proposal or respond to a question…"/></label><button className="btn btn-primary mt-3" disabled={send.isPending}>Post reply to portal</button></form>}</section>;
}
