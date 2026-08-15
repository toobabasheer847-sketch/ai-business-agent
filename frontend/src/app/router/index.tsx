import { Navigate, Route, Routes } from 'react-router-dom'

import { GuestRoute, ProtectedRoute } from '@/app/router/guards'
import { AuthLayout } from '@/layouts/auth-layout'
import { AppShellLayout } from '@/layouts/app-shell-layout'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { SystemStatusPage } from '@/features/system/pages/system-status-page'
import { PhoneNumbersPage } from '@/features/phone-numbers/pages/phone-numbers-page'
import { TwilioAppsPage } from '@/features/twilio-apps/pages/twilio-apps-page'
import { TenantPage } from '@/features/tenant/pages/tenant-page'
import { BrandsPage } from '@/features/brands/pages/brands-page'
import { MasterSettingsPage } from '@/features/master-settings/pages/master-settings-page'
import { CompaniesPage } from '@/features/companies/pages/companies-page'
import { LeadsPage } from '@/features/leads/pages/leads-page'
import { ProspectsPage } from '@/features/prospects/pages/prospects-page'
import { ModulePlaceholderPage } from '@/components/common/module-placeholder-page'

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
          <Route
            path="/conversations"
            element={
              <ModulePlaceholderPage
                title="Conversations"
                module="conversation"
                availableInAppModule={false}
                endpoints={[
                  'POST /api/conversations',
                  'GET /api/conversations',
                  'GET /api/conversations/:id',
                  'PATCH /api/conversations/:id',
                  'DELETE /api/conversations/:id',
                  'GET /api/conversations/:id/messages',
                  'POST /api/conversations/:id/messages',
                ]}
              />
            }
          />
          <Route
            path="/communication-hub"
            element={
              <ModulePlaceholderPage
                title="Communication Hub"
                module="communication-hub"
                availableInAppModule={false}
                endpoints={[
                  'GET /api/communication-hub',
                  'GET /api/communication-hub/stats',
                  'GET /api/communication-hub/email-threads',
                  'GET /api/communication-hub/sms-threads',
                  'GET /api/communication-hub/:id',
                ]}
              />
            }
          />
          <Route
            path="/proposals"
            element={
              <ModulePlaceholderPage
                title="Proposals"
                module="proposal"
                availableInAppModule={false}
                endpoints={[
                  'POST /api/proposals',
                  'GET /api/proposals',
                  'GET /api/proposals/:id',
                  'PATCH /api/proposals/:id',
                  'DELETE /api/proposals/:id',
                ]}
                notes="Separate AI proposal agent routes also exist under /api/api/ai/proposals (double prefix bug)."
              />
            }
          />
          <Route
            path="/knowledgebases"
            element={
              <ModulePlaceholderPage
                title="Knowledgebase"
                module="knowledgebase"
                availableInAppModule={false}
                endpoints={[
                  'POST /api/knowledgebases',
                  'GET /api/knowledgebases?search=',
                  'GET /api/knowledgebases/:id',
                  'PATCH /api/knowledgebases/:id',
                  'DELETE /api/knowledgebases/:id',
                ]}
              />
            }
          />
          <Route
            path="/gmail-configuration"
            element={
              <ModulePlaceholderPage
                title="Gmail Configuration"
                module="gmail-configuration"
                availableInAppModule={false}
                endpoints={[
                  'POST /api/gmail-configuration',
                  'GET /api/gmail-configuration',
                  'PATCH /api/gmail-configuration',
                  'PATCH /api/gmail-configuration/deactivate',
                  'DELETE /api/gmail-configuration',
                ]}
              />
            }
          />
          <Route path="/phone-numbers" element={<PhoneNumbersPage />} />
          <Route path="/twilio-apps" element={<TwilioAppsPage />} />
          <Route
            path="/users"
            element={
              <ModulePlaceholderPage
                title="Users"
                module="user"
                availableInAppModule={false}
                endpoints={[
                  'POST /api/users',
                  'GET /api/users',
                  'GET /api/users/:id',
                  'PATCH /api/users/:id',
                  'DELETE /api/users/:id',
                ]}
              />
            }
          />
          <Route path="/master-settings" element={<MasterSettingsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
