import { ReactNode, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, FileText, ShieldCheck, Truck, CreditCard, Receipt,
  HeartPulse, BarChart3, Settings, Search, Bell, ExternalLink, LogOut,
  User, Menu, X, Zap
} from 'lucide-react';

const allNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/quotations', label: 'Quotations & Deals', icon: FileText },
  { to: '/approvals', label: 'Approvals Workflow', icon: ShieldCheck },
  { to: '/fulfillment', label: 'Fulfillment & Orders', icon: Truck },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/invoices', label: 'Invoices & Billing', icon: Receipt },
  { to: '/deal-health', label: 'Deal Health AI', icon: HeartPulse },
  { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/config', label: 'Catalog & Rules', icon: Settings },
];

const navItemsByRole: Record<string, typeof allNavItems> = {
  sales_rep: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/quotations', label: 'My Quotations', icon: FileText },
    { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { to: '/deal-health', label: 'Deal Health AI', icon: HeartPulse },
  ],
  sales_manager: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/quotations', label: 'All Quotations', icon: FileText },
    { to: '/approvals', label: 'Approvals Queue', icon: ShieldCheck },
    { to: '/fulfillment', label: 'Fulfillment & Orders', icon: Truck },
    { to: '/deal-health', label: 'Deal Health AI', icon: HeartPulse },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/config', label: 'Catalog & Rules', icon: Settings },
  ],
  finance: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/approvals', label: 'Finance Sign-off', icon: ShieldCheck },
    { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { to: '/invoices', label: 'Invoices & Billing', icon: Receipt },
    { to: '/deal-health', label: 'Deal Health AI', icon: HeartPulse },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
  ],
  admin: allNavItems,
};

const roleLabels: Record<string, string> = {
  admin: 'ADMIN',
  sales_rep: 'SALES REP',
  sales_manager: 'SALES MANAGER',
  finance: 'FINANCE',
  customer: 'CUSTOMER',
};

const roleColors: Record<string, string> = {
  admin: 'bg-danger-light text-danger border-danger/20',
  sales_rep: 'bg-primary-light text-primary border-primary/20',
  sales_manager: 'bg-warning-light text-warning border-warning/20',
  finance: 'bg-success-light text-success border-success/20',
  customer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const demoPersonas = [
  { username: 'elena.vance', label: 'Elena Vance (Sales Rep)', role: 'sales_rep', password: 'demo123' },
  { username: 'm.shah', label: 'M. Shah (Sales Manager)', role: 'sales_manager', password: 'demo123' },
  { username: 'r.iyer', label: 'R. Iyer (Finance)', role: 'finance', password: 'demo123' },
  { username: 'admin', label: 'System Admin (Admin)', role: 'admin', password: 'admin123' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRoleSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = demoPersonas.find(p => p.username === e.target.value);
    if (!selected || selected.username === user?.username) return;

    setSwitching(true);
    try {
      await login(selected.username, selected.password);
      queryClient.clear();
      navigate('/dashboard');
    } catch (err) {
      console.error('Role switch error:', err);
    } finally {
      setSwitching(false);
    }
  };

  const currentRole = user?.role || 'admin';
  const visibleNavItems = navItemsByRole[currentRole] || allNavItems;

  const currentTitle = visibleNavItems.find(item => location.pathname.startsWith(item.to))?.label || 'DealFlow360';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar (VendorBridge layout) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-slate-200 md:bg-white shrink-0">
        {/* Brand Header */}
        <div 
          className="flex h-16 items-center px-6 border-b border-slate-100 space-x-3 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-md">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <span className="font-outfit text-lg font-bold tracking-tight text-slate-900">
              DealFlow<span className="text-primary">360</span>
            </span>
            <span className="text-[10px] block -mt-1 font-semibold text-primary font-sans">
              CPQ & REVOPS SUITE
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout (Pinned to Bottom) */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-slate-50 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold text-xs">
              {user?.first_name?.[0] || 'U'}{user?.last_name?.[0] || 'D'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {user?.email || `${user?.username}@dealflow360.com`}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-sm">
          <div className="relative flex w-full max-w-xs flex-col bg-white py-4 shadow-xl">
            <div className="flex items-center justify-between px-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="font-outfit text-lg font-bold text-slate-900">
                  DealFlow<span className="text-primary">360</span>
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 flex-1 space-y-1 px-3 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header (VendorBridge style) */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8 shadow-sm z-10">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-md font-bold text-slate-900 md:text-lg font-outfit">
                {currentTitle}
              </h1>
            </div>
          </div>

          {/* Center & Right Controls */}
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Quick Search */}
            <div className="relative hidden lg:block w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search deals, quotes..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              />
            </div>

            {/* Customer Portal Link */}
            <a
              href="/portal"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-primary transition-all"
            >
              <span>Customer Portal</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>

            {/* Quick Role Testing Switcher Widget (VendorBridge exact pattern) */}
            <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50/50 p-1.5 shadow-sm">
              <span className="hidden xl:inline text-[10px] font-bold tracking-wider text-slate-500 uppercase px-2">
                Simulate Role:
              </span>
              <select
                value={user?.username || ''}
                onChange={handleRoleSwitch}
                disabled={switching}
                className="text-xs font-semibold bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
              >
                {demoPersonas.map(p => (
                  <option key={p.username} value={p.username}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleColors[currentRole] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {roleLabels[currentRole] || currentRole}
              </span>
            </div>

            {/* Notifications */}
            <button 
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white shadow">
                {currentRole === 'sales_manager' || currentRole === 'finance' ? '4' : '1'}
              </span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 text-[10px] text-slate-500">
          <span>DealFlow360 Enterprise Revenue Operations Platform <span className="font-mono">v4.18.2-prod</span></span>
          <div className="hidden sm:flex items-center space-x-4">
            <span>System SLA 99.98%</span>
            <span>Audited SOC2 Type II</span>
            <span>© 2025 DealFlow360 Inc. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
