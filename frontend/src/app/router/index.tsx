import { Navigate, Route, Routes } from 'react-router-dom'

import { GuestRoute, ProtectedRoute } from '@/app/router/guards'
import { AuthLayout } from '@/layouts/auth-layout'
import { AppShellLayout } from '@/layouts/app-shell-layout'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { SystemStatusPage } from '@/features/system/pages/system-status-page'
import { PhoneNumbersPage } from '@/features/phone-numbers/pages/phone-numbers-page'
import { TenantPage } from '@/features/tenant/pages/tenant-page'
import { BrandsPage } from '@/features/brands/pages/brands-page'
import { MasterSettingsPage } from '@/features/master-settings/pages/master-settings-page'
import { CompaniesPage } from '@/features/companies/pages/companies-page'
import { LeadsPage } from '@/features/leads/pages/leads-page'
import { ProspectsPage } from '@/features/prospects/pages/prospects-page'
import { ConversationsPage } from '@/features/conversations/pages/conversations-page'
import { CommunicationHubPage } from '@/features/communication-hub/pages/communication-hub-page'
import { GmailConfigurationPage } from '@/features/gmail-configuration/pages/gmail-configuration-page'
import { ProposalsPage } from '@/features/proposals/pages/proposals-page'
import { KnowledgebasesPage } from '@/features/knowledgebases/pages/knowledgebases-page'
import { UsersPage } from '@/features/users/pages/users-page'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShellLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/system" element={<SystemStatusPage />} />
          <Route path="/tenant" element={<TenantPage />} />

          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/prospects" element={<ProspectsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/communication-hub" element={<CommunicationHubPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/knowledgebases" element={<KnowledgebasesPage />} />
          <Route path="/gmail-configuration" element={<GmailConfigurationPage />} />
          <Route path="/phone-numbers" element={<PhoneNumbersPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/master-settings" element={<MasterSettingsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
