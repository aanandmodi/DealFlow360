import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { quotationsApi } from '../../api/quotations';
import { DealCopilotDrawer } from '../copilot/DealCopilotDrawer';
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Truck,
  CreditCard,
  Receipt,
  HeartPulse,
  BarChart3,
  Settings,
  Search,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Layers,
  Package,
  Bot,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  animClass: string;
  hasSmoke?: boolean;
}

const items: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, animClass: 'anim-overview-flip' },
  { to: '/quotations', label: 'Quotations', icon: FileText, animClass: 'anim-quotation-flip' },
  { to: '/approvals', label: 'Approval desk', icon: ShieldCheck, roles: ['admin', 'sales_manager', 'finance'], animClass: 'anim-shield-defend' },
  { to: '/fulfillment', label: 'Fulfillment', icon: Truck, roles: ['admin', 'sales_manager', 'finance'], animClass: 'anim-truck-burnout', hasSmoke: true },
  { to: '/inventory', label: 'Inventory', icon: Package, roles: ['admin', 'sales_manager', 'finance'], animClass: 'anim-package-wobble' },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard, animClass: 'anim-card-swipe' },
  { to: '/invoices', label: 'Invoices & payments', icon: Receipt, animClass: 'anim-receipt-feed' },
  { to: '/deal-health', label: 'Deal health', icon: HeartPulse, animClass: 'anim-heart-thump' },
  { to: '/reports', label: 'Reports', icon: BarChart3, animClass: 'anim-chart-surge' },
  { to: '/config', label: 'Catalog & rules', icon: Settings, roles: ['admin', 'sales_manager'], animClass: 'anim-gear-spin' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [animatingTab, setAnimatingTab] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [logoSpin, setLogoSpin] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const visible = items.filter((i) => !i.roles || i.roles.includes(user?.role || ''));
  const title = visible.find((i) => location.pathname.startsWith(i.to))?.label || 'Workspace';
  const { data: quotes = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => quotationsApi.list(),
    refetchInterval: 30000,
  });
  const pending = quotes.filter((q) => q.status === 'pending_approval').length;

  const triggerAnimation = (to: string) => {
    setAnimatingTab(null);
    requestAnimationFrame(() => {
      setAnimatingTab(to);
      setAnimKey((prev) => prev + 1);
    });
  };

  const nav = (
    <>
      <NavLink
        to="/dashboard"
        className="flex items-center gap-3 px-5 h-20 border-b border-slate-100 group"
        onClick={() => {
          setLogoSpin(true);
          setTimeout(() => setLogoSpin(false), 700);
        }}
      >
        <span
          className={`w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center transition-transform duration-500 shadow-sm ${
            logoSpin ? 'rotate-180 scale-110' : 'group-hover:scale-105'
          }`}
        >
          <Layers size={19} />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          DealFlow<span className="text-slate-400 font-normal">360</span>
        </span>
      </NavLink>

      <div className="mx-4 my-5 px-3 py-3 border border-slate-200 rounded-lg bg-slate-50/50">
        <div className="text-xs font-semibold text-slate-800">Sales workspace</div>
        <div className="text-xs text-slate-500 mt-1">India · INR</div>
      </div>

      <nav aria-label="Main navigation" className="px-3 flex-1 space-y-1 overflow-y-auto">
        {visible.map((i) => {
          const isCurrentAnimating = animatingTab === i.to;
          return (
            <NavLink
              key={i.to}
              to={i.to}
              onClick={() => {
                setMobile(false);
                triggerAnimation(i.to);
              }}
              className={({ isActive }) =>
                `nav-tab-link group flex gap-3 items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-150 select-none ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <span
                key={`${i.to}-${isCurrentAnimating ? animKey : 'idle'}`}
                className={`nav-icon-wrap ${isCurrentAnimating && i.hasSmoke ? 'has-truck-smoke' : ''}`}
              >
                <i.icon
                  size={17}
                  strokeWidth={1.75}
                  className={`nav-icon-svg ${isCurrentAnimating ? `${i.animClass} animating` : ''}`}
                  onAnimationEnd={() => setAnimatingTab(null)}
                />
              </span>
              <span>{i.label}</span>
              {i.to === '/approvals' && pending > 0 && (
                <span className="ml-auto text-[11px] bg-white border border-blue-200 text-blue-700 font-bold rounded-full px-2 py-0.5 shadow-xs">
                  {pending}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 mt-5 flex items-center gap-3 bg-white">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center font-semibold text-xs border border-blue-200">
          {user?.first_name?.[0] || user?.username?.[0]}
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block text-xs truncate text-slate-800">
            {user?.first_name || user?.username} {user?.last_name}
          </strong>
          <span className="text-[11px] text-slate-500 capitalize">
            {user?.role?.replaceAll('_', ' ')}
          </span>
        </div>
        <button
          title="Sign out"
          aria-label="Sign out"
          className="icon-button text-slate-400 hover:text-rose-600 transition-colors"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white shadow-xs">
        {nav}
      </aside>

      {mobile && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex">
          <aside className="w-72 bg-white flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {nav}
          </aside>
          <button
            className="m-4 text-white self-start p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-w-0 flex-col">
        <header className="h-16 shrink-0 flex items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-7">
          <button
            className="md:hidden icon-button"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={19} />
          </button>
          <span className="text-xs text-slate-400 hidden sm:inline">Workspace</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-xs font-semibold text-slate-700">{title}</span>

          <div className="hidden xl:flex items-center gap-1 border-l border-slate-200 pl-3">
            <NavLink
              to="/quotations"
              end
              className={({ isActive }) =>
                `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-100'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              Pipeline (Kanban)
            </NavLink>
            <NavLink
              to="/quotations/list"
              className={({ isActive }) =>
                `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-100'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              Quotations (List)
            </NavLink>
          </div>

          <form
            className="ml-auto hidden lg:flex items-center gap-2 text-slate-400"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/quotations?search=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={16} />
            <input
              aria-label="Search deals"
              className="!border-0 !bg-transparent !shadow-none !min-h-8 !w-40 !text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              placeholder="Find a quotation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="text-[11px] border border-slate-200 rounded px-1.5 text-slate-400 font-mono">
              ↵
            </kbd>
          </form>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs border border-blue-700 transition-all cursor-pointer shrink-0"
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              title="Open AI Deal Copilot (Alt + C)"
              aria-label="Open AI Deal Copilot"
            >
              <Bot size={15} className="text-white shrink-0" />
              <span className="text-white font-semibold text-xs whitespace-nowrap">AI Deal Copilot</span>
              <span className="text-[10px] bg-blue-700/80 text-white font-mono px-1.5 py-0.5 rounded leading-none hidden sm:inline">Alt+C</span>
            </button>

            <button
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
              aria-label="Reload Data"
              title="Reload Data (Refreshes pricing, stock, and approval data from backend)"
              onClick={() => {
                setReloading(true);
                qc.invalidateQueries().finally(() => {
                  setTimeout(() => setReloading(false), 500);
                });
              }}
            >
              <RefreshCw size={13} className={reloading ? 'animate-spin text-blue-600' : ''} />
              <span className="hidden sm:inline">Reload Data</span>
            </button>

            {(user?.role === 'admin' || user?.role === 'sales_manager') && (
              <NavLink
                to="/config"
                title="Go to Back-end (Configuration & Settings)"
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Settings size={13} />
                <span>Go to Back-end</span>
              </NavLink>
            )}

            <button
              title="Close Workspace"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
            >
              <LogOut size={13} />
              <span>Close Workspace</span>
            </button>
          </div>

          <span className="border-l border-slate-200 pl-3 text-[11px] font-medium text-slate-500 hidden sm:inline">
            INR
          </span>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>

        <DealCopilotDrawer isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />

        <footer className="border-t border-slate-200 bg-white px-6 py-2 text-[10px] text-slate-500 flex justify-between">
          <span>DealFlow360</span>
          <span>Connected quotation, inventory and billing</span>
        </footer>
      </div>
    </div>
  );
}
