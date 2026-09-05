/**
 * App Shell — B1: Top nav with DealFlow360 branding and navigation.
 * Enterprise design matching the reference screenshots.
 */
import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FileText, ShieldCheck, Truck, CreditCard, Receipt,
  HeartPulse, BarChart3, Settings, Search, Bell, ExternalLink, LogOut, RefreshCw
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/quotations', label: 'Quotations', icon: FileText },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/fulfillment', label: 'Fulfillment', icon: Truck },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/invoices', label: 'Invoices', icon: Receipt },
  { to: '/deal-health', label: 'Deal Health', icon: HeartPulse },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/config', label: 'Products & Config', icon: Settings },
];

const roleLabels: Record<string, string> = {
  admin: 'ADMIN',
  sales_rep: 'SALES REP',
  sales_manager: 'LEAD ADMIN',
  finance: 'FINANCE',
  customer: 'CUSTOMER',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-canvas)' }}>
      {/* Top Header Bar */}
      <header
        className="flex items-center h-14 px-4 gap-4 shrink-0"
        style={{
          background: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-surface-border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs"
               style={{ background: '#2563EB' }}>
            A
          </div>
          <span className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
            DealFlow<span style={{ color: '#2563EB' }}>360</span>
          </span>
        </div>

        {/* Org Selector */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
             style={{ background: 'var(--color-surface-inset)', color: 'var(--color-text-secondary)' }}>
          <span className="font-medium">ORG</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>North America Enterprise - FY25</span>
          <span className="text-[10px]">▼</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />
            <input
              type="text"
              placeholder="Search deals, quotes, customer"
              className="input pl-9"
              style={{ height: 32, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Customer Portal Link */}
        <a
          href="/portal"
          target="_blank"
          className="btn btn-ghost btn-sm gap-1.5 hidden lg:flex"
          style={{ fontSize: 12 }}
        >
          Customer Portal <ExternalLink className="w-3 h-3" />
        </a>

        {/* Notifications */}
        <button className="relative btn btn-ghost" style={{ width: 36, height: 36, padding: 0 }}>
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ background: '#E11D48' }}>
            3
          </span>
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 ml-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
               style={{ background: '#475569' }}>
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
              {user?.first_name} {user?.last_name}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>
              {user?.role === 'sales_manager' ? 'Sales Director' : user?.role?.replace('_', ' ')}
            </span>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-shell)', color: 'white', letterSpacing: '0.05em' }}>
            {roleLabels[user?.role || ''] || 'USER'}
          </span>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: 32, height: 32, padding: 0 }}>
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav
        className="flex items-center h-10 px-4 gap-1 shrink-0 overflow-x-auto"
        style={{
          background: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-surface-border)',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-colors relative whitespace-nowrap ${
                isActive ? '' : 'hover:opacity-80'
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? '#2563EB' : 'var(--color-text-secondary)',
              borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
              textDecoration: 'none',
            })}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </NavLink>
        ))}

        {/* Right side nav actions */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-caption)' }}>
            <span className="text-xs">🏠</span> / Workspace / <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Active Context</span>
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Footer */}
      <footer
        className="flex items-center justify-between h-8 px-4 shrink-0 text-[10px]"
        style={{
          background: 'var(--color-surface-card)',
          borderTop: '1px solid var(--color-surface-border)',
          color: 'var(--color-text-caption)',
        }}
      >
        <span>DealFlow360 Enterprise Revenue Operations Platform <span className="font-mono">v4.18.2-prod</span></span>
        <div className="flex items-center gap-4">
          <span>System SLA 99.98%</span>
          <span>Audited SOC2 Type II</span>
          <span>© 2025 DealFlow360 Inc. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
