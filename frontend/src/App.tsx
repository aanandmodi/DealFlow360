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
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
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
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
      <p className="text-sm" style={{ color: 'var(--color-text-caption)' }}>
        This screen will be built by Person B. Plug your component in here.
      </p>
      <div className="card mt-6 flex items-center justify-center py-24">
        <span className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>
          Component placeholder — awaiting teammate integration
        </span>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />

      {/* Portal — separate layout, no auth required */}
      <Route path="/portal/quotations/:token" element={<PortalNegotiationPage />} />
      <Route path="/portal/quotation/:token" element={<PortalNegotiationPage />} />
      <Route path="/portal" element={<PortalNegotiationPage />} />

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
              <Route path="/approvals" element={<ApprovalListPage />} />
              <Route path="/approvals/:id" element={<ApprovalDetailPage />} />
              <Route path="/fulfillment" element={<FulfillmentPage />} />
              <Route path="/subscriptions" element={<BillingPage />} />
              <Route path="/invoices" element={<BillingPage />} />
              <Route path="/deal-health" element={<DealHealthDashboard />} />
              <Route path="/reports" element={<PlaceholderPage title="Reports — Executive Analytics" />} />
              <Route path="/config" element={<PlaceholderPage title="Products & Config — use /admin/ for Django Admin" />} />
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
