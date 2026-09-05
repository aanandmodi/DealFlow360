import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './features/shell/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { PipelinePage } from './features/pipeline/PipelinePage';
import { QuotationListPage } from './features/pipeline/QuotationListPage';
import { QuotationBuilderPage } from './features/quotation-builder/QuotationBuilderPage';
import { ApprovalListPage } from './features/approval/ApprovalListPage';
import { ApprovalDetailPage } from './features/approval/ApprovalDetailPage';
import { SalesDashboard } from './features/dashboard/SalesDashboard';
import { DealHealthDashboard } from './features/dashboard/DealHealthDashboard';
import { PortalNegotiationPage } from './features/portal-negotiation/PortalNegotiationPage';
import { FulfillmentPage } from './features/fulfillment/FulfillmentPage';
import { BillingPage } from './features/billing/BillingPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { CatalogRulesPage } from './features/config/CatalogRulesPage';
import { QuotationVerificationPage } from './features/verification/QuotationVerificationPage';
import { LandingPage } from './features/landing/LandingPage';
import './index.css';
import './features/workspace/workspace.css';
import { InvoicesPage } from './features/workspace/InvoicesPage';
import { InventoryPage } from './features/workspace/InventoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-canvas)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
               style={{ background: '#2563EB' }}>A</div>
          <div className="text-sm" style={{ color: 'var(--color-text-caption)' }}>Loading DealFlow360...</div>
        </div>
      </div>
    );
  }
  if (user?.role === 'customer') return <Navigate to="/portal" />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

function RoleRoute({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16 text-center card">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Access Restricted</h2>
        <p className="text-xs mb-6 text-slate-500">
          This area requires <strong>{allowedRoles.map(r => r.replace('_', ' ')).join(' or ')}</strong> role.
          You are currently logged in as <span className="font-semibold text-slate-800">{user.role.replace('_', ' ')}</span> ({user.first_name} {user.last_name}).
        </p>
        <Link to="/dashboard" className="btn btn-primary inline-flex items-center gap-2 mx-auto">
          Return to Dashboard
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />

      {/* Portal — separate layout, no auth required */}
      <Route path="/portal/quotations/:token" element={<PortalNegotiationPage />} />
      <Route path="/portal/quotation/:token" element={<PortalNegotiationPage />} />
      <Route path="/portal" element={<PortalNegotiationPage />} />

      {/* Public Cryptographic Verification Route — no auth required */}
      <Route path="/verify/:quoteNumber" element={<QuotationVerificationPage />} />
      <Route path="/verify" element={<QuotationVerificationPage />} />

      {/* Internal — protected routes with AppShell */}
      <Route path="/*" element={
        <ProtectedRoute>
          <AppShell>
            <Routes>
              <Route path="/dashboard" element={<SalesDashboard />} />
              <Route path="/quotations" element={<PipelinePage />} />
              <Route path="/quotations/list" element={<QuotationListPage />} />
              <Route path="/quotations/new" element={<QuotationBuilderPage />} />
              <Route path="/quotations/:id" element={<QuotationBuilderPage />} />
              <Route path="/approvals" element={
                <RoleRoute allowedRoles={['sales_manager', 'finance', 'admin']}>
                  <ApprovalListPage />
                </RoleRoute>
              } />
              <Route path="/approvals/:id" element={
                <RoleRoute allowedRoles={['sales_manager', 'finance', 'admin']}>
                  <ApprovalDetailPage />
                </RoleRoute>
              } />
              <Route path="/fulfillment" element={
                <RoleRoute allowedRoles={['sales_manager', 'finance', 'admin']}>
                  <FulfillmentPage />
                </RoleRoute>
              } />
              <Route path="/subscriptions" element={<BillingPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/inventory" element={<RoleRoute allowedRoles={['admin','sales_manager','finance']}><InventoryPage/></RoleRoute>} />
              <Route path="/deal-health" element={<DealHealthDashboard />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/config" element={
                <RoleRoute allowedRoles={['sales_manager', 'admin']}>
                  <CatalogRulesPage />
                </RoleRoute>
              } />
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
