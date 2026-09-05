import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {Sparkles,Plus,X,TrendingUp} from 'lucide-react';
import {getUpsellSuggestions} from '../../api/billing';
import {addLine} from '../../api/quotations';
import {formatCurrency} from '../../lib/utils';
import {Notice} from '../workspace/shared';
export function UpsellPanel({quotationId,onAddProduct,revision}:{quotationId:number;onAddProduct?:unknown;revision?:string}){
 const qc=useQueryClient();const [dismissed,setDismissed]=useState<number[]>([]);
 const query=useQuery({queryKey:['upsell',quotationId,revision],queryFn:()=>getUpsellSuggestions(quotationId)});
 const add=useMutation({mutationFn:(product:number)=>addLine(quotationId,{product,quantity:1,discount_percent:0}),onSuccess:()=>qc.invalidateQueries()});
 const suggestions=(query.data?.suggestions||[]).filter(s=>!dismissed.includes(s.id));
 if(!onAddProduct||!suggestions.length)return null;
 return <section className="panel"><div className="panel-head"><div><div className="eyebrow">A THOUGHTFUL ADDITION</div><h2><Sparkles size={15} style={{display:'inline',marginRight:7}}/>Complete the solution</h2></div><span className="muted">Based on configured product pairings</span></div><div className="upsell-grid">{suggestions.map(s=><article className="upsell-item" key={s.id}><div><strong>{s.suggested_product.name}</strong><button aria-label={`Dismiss ${s.suggested_product.name}`} className="icon-button" onClick={()=>setDismissed([...dismissed,s.id])}><X size={14}/></button></div>{s.is_promoted&&<span className="pill pill-amber">Promoted</span>}<p>{formatCurrency(s.suggested_product.base_price)}</p><small><TrendingUp size={13}/> Adds {formatCurrency(s.margin_delta)} gross profit before tax</small><button disabled={add.isPending} className="btn btn-secondary btn-sm" onClick={()=>add.mutate(s.suggested_product.id)}><Plus size={14}/>Add to quotation</button></article>)}</div><Notice error={add.error}/></section>;
}
