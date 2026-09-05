/**
 * AppShell — B1 top navigation + layout wrapper.
 * Matches the reference: dark slate shell with enterprise blue tabs.
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchMe, logout, type User } from '../../api/auth';
import { isAuthenticated } from '../../api/client';
import { LayoutDashboard, FileText, ShieldCheck, Truck, CreditCard, Receipt, Activity, BarChart3, Settings, LogOut, Bell, ExternalLink, Search } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/quotations', label: 'Quotations', icon: FileText },
  { path: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { path: '/fulfillment', label: 'Fulfillment', icon: Truck },
  { path: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/invoices', label: 'Invoices', icon: Receipt },
  { path: '/deal-health', label: 'Deal Health', icon: Activity },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/config', label: 'Products & Config', icon: Settings },
];

export function AppShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchMe().then(setUser).catch(() => navigate('/login'));
  }, [navigate]);

  if (!user) return null;

  const roleLabel = user.role === 'sales_rep' ? 'Sales Rep'
    : user.role === 'sales_manager' ? 'Sales Manager'
    : user.role === 'finance' ? 'Finance'
    : 'Admin';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-canvas)]">
      {/* Top Navigation Bar */}
      <header className="bg-[var(--color-shell)] text-[var(--color-shell-text)] h-14 flex items-center px-6 gap-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <span className="font-semibold text-white text-base tracking-tight">DealFlow360</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-disabled)]" />
          <input
            type="text"
            placeholder="Search deals, quotes, customer"
            className="w-full h-8 pl-9 pr-3 bg-[#1E293B] border border-[#334155] rounded text-sm text-[var(--color-shell-text)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="flex-1" />

        {/* Customer Portal link */}
        <button className="flex items-center gap-1.5 text-sm text-[var(--color-shell-text)] hover:text-white transition">
          Customer Portal <ExternalLink className="w-3.5 h-3.5" />
        </button>

        {/* Notifications */}
        <button className="relative p-1.5 hover:bg-[#1E293B] rounded transition">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-rose)] rounded-full text-[10px] font-bold flex items-center justify-center text-white">3</span>
        </button>

        {/* User */}
        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-semibold">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div className="text-sm">
            <div className="font-medium text-white leading-tight">{user.first_name} {user.last_name}</div>
            <div className="text-xs text-[var(--color-text-disabled)] leading-tight">{roleLabel}</div>
          </div>
          <span className="ml-1 px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-[10px] font-semibold uppercase tracking-wider">
            {user.role === 'admin' ? 'ADMIN' : roleLabel.toUpperCase()}
          </span>
        </div>

        <button
          onClick={logout}
          className="p-1.5 hover:bg-[#1E293B] rounded transition text-[var(--color-text-disabled)] hover:text-white"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Secondary Nav — Tab bar */}
      <nav className="bg-white border-b border-[var(--color-border)] h-10 flex items-center px-6 gap-1 shrink-0">
        {navItems.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-medium rounded transition-colors ${
                isActive
                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] -mb-[1px]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]'
              }`
            }
          >
            {label}
          </NavLink>
        ))}

        <div className="flex-1" />
        <span className="text-xs text-[var(--color-text-muted)]">⌂ / Workspace / Active Context</span>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="h-8 bg-white border-t border-[var(--color-border)] flex items-center px-6 text-xs text-[var(--color-text-muted)] gap-6 shrink-0">
        <span>DealFlow360 Enterprise Revenue Operations Platform</span>
        <span className="font-mono">v1.0.0-hackathon</span>
        <div className="flex-1" />
        <span>System SLA 99.98%</span>
        <span>© 2026 DealFlow360 Inc.</span>
      </footer>
    </div>
  );
}
