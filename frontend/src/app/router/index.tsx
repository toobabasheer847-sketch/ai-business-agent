import { Navigate, Route, Routes } from 'react-router-dom'

import { GuestRoute, Permit, ProtectedRoute } from '@/app/router/guards'
import { Permission } from '@/features/authorization/permissions'
import { AuthLayout } from '@/layouts/auth-layout'
import { AppShellLayout } from '@/layouts/app-shell-layout'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { AnalyticsPage } from '@/features/analytics/pages/analytics-page'
import { AiMonitoringPage } from '@/features/ai-monitoring/pages/ai-monitoring-page'
import { ApprovalsPage } from '@/features/approvals/pages/approvals-page'
import { ExceptionsPage } from '@/features/exceptions/pages/exceptions-page'
import { WorkflowsPage } from '@/features/workflows/pages/workflows-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { AssistantPage } from '@/features/assistant/pages/assistant-page'
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
import { PublicProposalPage } from '@/features/public-proposal/pages/public-proposal-page'
import { KnowledgebasesPage } from '@/features/knowledgebases/pages/knowledgebases-page'
import { UsersPage } from '@/features/users/pages/users-page'
import { TasksPage } from '@/features/tasks/pages/tasks-page'
import { TaskAnalyticsPage } from '@/features/tasks/pages/task-analytics-page'

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
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/ai-monitoring" element={<Permit permissions={[Permission.AuditView, Permission.AssistantUse]}><AiMonitoringPage /></Permit>} />
          <Route path="/exceptions" element={<Permit permissions={[Permission.AuditView]}><ExceptionsPage /></Permit>} />
          <Route path="/workflows" element={<Permit permissions={[Permission.WorkflowManage]}><WorkflowsPage /></Permit>} />
          <Route path="/approvals" element={<Permit permissions={[Permission.AuditView, Permission.AssistantUse]}><ApprovalsPage /></Permit>} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/tasks/analytics" element={<TaskAnalyticsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/system" element={<SystemStatusPage />} />
          <Route path="/tenant" element={<Permit permissions={[Permission.TenantManage]}><TenantPage /></Permit>} />

          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/prospects" element={<ProspectsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/communication-hub" element={<CommunicationHubPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/knowledgebases" element={<Permit permissions={[Permission.KnowledgeManage]}><KnowledgebasesPage /></Permit>} />
          <Route path="/gmail-configuration" element={<Permit permissions={[Permission.IntegrationManage]}><GmailConfigurationPage /></Permit>} />
          <Route path="/phone-numbers" element={<Permit permissions={[Permission.IntegrationManage]}><PhoneNumbersPage /></Permit>} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/master-settings" element={<Permit permissions={[Permission.TenantManage]}><MasterSettingsPage /></Permit>} />
        </Route>
      </Route>

      <Route path="/p/:token" element={<PublicProposalPage />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
