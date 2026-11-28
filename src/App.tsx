import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { FEATURE_TAWAD_ENABLED } from '@/constants'
import '@/stores/text-size-store'
import { useBackendSync } from '@/hooks/useBackendSync'
import { useIdleLogout } from '@/hooks/useIdleLogout'
import { BrandLoader } from '@/components/shared/BrandLoader'
import { RequireAuth } from '@/components/shared/RequireAuth'
import AdminLayout from '@/features/admin/layouts/AdminLayout'
import AuthPage from '@/features/auth/AuthPage'
import AdminDashboardPage from '@/features/admin/pages/AdminDashboardPage'
import AdminCommoditiesPage from '@/features/admin/pages/AdminCommoditiesPage'
import AdminPriceHistoryPage from '@/features/admin/pages/AdminPriceHistoryPage'
import AdminBranchesPage from '@/features/admin/pages/AdminBranchesPage'
import AdminVendorsPage from '@/features/admin/pages/AdminVendorsPage'
import AdminVendorDetailPage from '@/features/admin/pages/AdminVendorDetailPage'
import AdminUsersPage from '@/features/admin/pages/AdminUsersPage'
import AdminUserDetailPage from '@/features/admin/pages/AdminUserDetailPage'
import AdminOffersPage from '@/features/admin/pages/AdminOffersPage'
import AdminOrdersPage from '@/features/admin/pages/AdminOrdersPage'
import NotFoundPage from '@/features/customer/pages/NotFoundPage'

function AppShell() {
  const { catalogReady, catalogError, apiConfigured } = useBackendSync()
  useIdleLogout()

  if (apiConfigured && !catalogReady) {
    return <BrandLoader fullScreen label="Loading Palengke" />
  }

  return (
    <>
      {catalogError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          Catalog warning: {catalogError}. Some listings may be empty until the API is available.
        </div>
      ) : null}
      <Routes>
        <Route path="login" element={<AuthPage portal="lgu-admin" />} />
        <Route path="admin/login" element={<AuthPage portal="lgu-admin" />} />
        <Route path="auth" element={<Navigate to="/login" replace />} />

        <Route
          path="admin"
          element={
            <RequireAuth roles={['lgu-admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="commodities" element={<AdminCommoditiesPage />} />
          <Route path="price-history" element={<AdminPriceHistoryPage />} />
          <Route path="branches" element={<AdminBranchesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="vendors/:vendorId" element={<AdminVendorDetailPage />} />
          <Route
            path="offers"
            element={
              FEATURE_TAWAD_ENABLED ? (
                <AdminOffersPage />
              ) : (
                <Navigate to="/admin" replace />
              )
            }
          />
          <Route path="orders" element={<AdminOrdersPage />} />
        </Route>

        <Route index element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster richColors position="top-center" closeButton />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
