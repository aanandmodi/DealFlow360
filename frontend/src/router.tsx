import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './features/shell/AppShell';
import { LoginPage } from './features/shell/LoginPage';
import { DashboardPage } from './features/shell/DashboardPage';
import { QuotationListPage } from './features/pipeline/QuotationListPage';
import { QuotationBuilderPage } from './features/quotation-builder/QuotationBuilderPage';
import { ApprovalListPage } from './features/approval/ApprovalListPage';
import { ApprovalDetailPage } from './features/approval/ApprovalDetailPage';
import { PlaceholderPage } from './features/shell/PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'quotations', element: <QuotationListPage /> },
      { path: 'quotations/new', element: <QuotationBuilderPage /> },
      { path: 'quotations/:id', element: <QuotationBuilderPage /> },
      { path: 'approvals', element: <ApprovalListPage /> },
      { path: 'approvals/:id', element: <ApprovalDetailPage /> },
      { path: 'fulfillment', element: <PlaceholderPage title="Fulfillment" subtitle="Person B builds this" /> },
      { path: 'subscriptions', element: <PlaceholderPage title="Subscriptions" subtitle="Person B builds this" /> },
      { path: 'invoices', element: <PlaceholderPage title="Invoices" subtitle="Person B builds this" /> },
      { path: 'deal-health', element: <PlaceholderPage title="Deal Health" subtitle="Person C builds this" /> },
      { path: 'reports', element: <PlaceholderPage title="Reports" subtitle="Coming soon" /> },
      { path: 'config', element: <PlaceholderPage title="Products & Config" subtitle="Via Django Admin" /> },
    ],
  },
]);
