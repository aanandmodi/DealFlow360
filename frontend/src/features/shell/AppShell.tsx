import { ReactNode, useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, FileText, ShieldCheck, Truck, CreditCard, Receipt, HeartPulse, BarChart3, Settings, Search, LogOut, RefreshCw, Menu, Layers, ArrowUpRight, X } from 'lucide-react';
const links = [
 {to:'/dashboard',label:'Overview',icon:LayoutDashboard,roles:['admin','sales_rep','sales_manager','finance']},
 {to:'/quotations',label:'Quotations',icon:FileText,roles:['admin','sales_rep','sales_manager','finance']},
 {to:'/approvals',label:'Approval desk',icon:ShieldCheck,roles:['admin','sales_manager','finance']},
 {to:'/fulfillment',label:'Fulfillment',icon:Truck,roles:['admin','sales_manager','finance']},
 {to:'/subscriptions',label:'Subscriptions',icon:CreditCard,roles:['admin','sales_rep','sales_manager','finance']},
 {to:'/invoices',label:'Invoices & payments',icon:Receipt,roles:['admin','sales_rep','sales_manager','finance']},
 {to:'/deal-health',label:'Deal health',icon:HeartPulse,roles:['admin','sales_rep','sales_manager','finance']},
 {to:'/reports',label:'Reports',icon:BarChart3,roles:['admin','sales_rep','sales_manager','finance']},
 {to:'/config',label:'Configuration',icon:Settings,roles:['admin','sales_manager']},
];
export function AppShell({children}:{children:ReactNode}) {
 const {user,logout}=useAuth();const qc=useQueryClient();const navigate=useNavigate();
 const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const [refreshing,setRefreshing]=useState(false);
 const nav=links.filter(l=>l.roles.includes(user?.role||''));
 return <div className="app-frame"><a className="skip-link" href="#main-content">Skip to content</a>{open&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
 <aside className={`workspace-sidebar ${open?'sidebar-open':''}`}><Link to="/dashboard" className="brand"><span className="brand-mark"><Layers size={23}/></span><span>DealFlow<span className="brand-360">360</span><small>THE CONNECTED DEAL ENGINE</small></span></Link>
 <div className="workspace-switch"><div className="workspace-avatar">D</div><div><strong>Sales workspace</strong><small>India · INR</small></div><span className="live-dot"/></div>
 <div className="nav-caption">WORKSPACE</div><nav aria-label="Main navigation">{nav.map(({to,label,icon:Icon},i)=><NavLink key={to} to={to} className={({isActive})=>`sidebar-link ${isActive?'active':''} ${i===6?'nav-separator':''}`} onClick={()=>setOpen(false)}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
 <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={20}/><strong>Every deal. In good hands.</strong><p>Pricing guardrails and connected operations, from quote to cash.</p></div><div className="sidebar-profile"><span className="profile-avatar">{(user?.first_name||user?.username||'U').slice(0,1)}</span><div><strong>{user?.first_name || user?.username} {user?.last_name}</strong><small>{user?.role.replaceAll('_',' ')}</small></div><button aria-label="Sign out" onClick={()=>{logout();navigate('/login');}}><LogOut size={17}/></button></div></div></aside>
 <div className="workspace-body"><header className="workspace-topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setOpen(true)}><Menu size={21}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{nav.find(l=>window.location.pathname.startsWith(l.to))?.label||'Quotation'}</strong></div><form className="topbar-search" onSubmit={e=>{e.preventDefault();navigate(`/quotations?search=${encodeURIComponent(search)}`);}}><Search size={16}/><input aria-label="Search deals" placeholder="Find a deal…" value={search} onChange={e=>setSearch(e.target.value)}/><kbd>↵</kbd></form><button className="icon-button" aria-label="Reload workspace data" disabled={refreshing} onClick={async()=>{setRefreshing(true);await qc.invalidateQueries();setRefreshing(false);}}><RefreshCw size={17} className={refreshing?'spin':''}/></button><span className="topbar-separator"/><span className="region-label">INR <span>🇮🇳</span></span><span className="profile-avatar small">{(user?.first_name||user?.username||'U').slice(0,1)}</span></header><main id="main-content">{children}</main><footer className="workspace-footer"><span>DealFlow360 · Thoughtful sales operations.</span><span>All monetary values in Indian rupees.</span></footer></div></div>;
}
