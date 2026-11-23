export type TenantRole = 'owner' | 'admin' | 'member'

export const Permission = {
  DashboardView: 'dashboard.view',
  AnalyticsView: 'analytics.view',
  AnalyticsViewOwn: 'analytics.view_own',
  TeamManage: 'team.manage',
  TeamView: 'team.view',
  TeamChangeRole: 'team.change_role',
  TenantView: 'tenant.view',
  TenantManage: 'tenant.manage',
  CompanyView: 'company.view',
  CompanyCreate: 'company.create',
  CompanyUpdateAny: 'company.update_any',
  CompanyUpdateOwn: 'company.update_own',
  CompanyDelete: 'company.delete',
  LeadManage: 'lead.manage',
  ProspectManage: 'prospect.manage',
  TaskCreate: 'task.create',
  TaskViewAll: 'task.view_all',
  TaskViewOwn: 'task.view_own',
  TaskUpdateAssigned: 'task.update_assigned',
  TaskDelete: 'task.delete',
  ProposalView: 'proposal.view',
  ProposalCreate: 'proposal.create',
  ProposalManage: 'proposal.manage',
  ProposalSend: 'proposal.send',
  CommunicationView: 'communication.view',
  CommunicationViewOwn: 'communication.view_own',
  KnowledgeManage: 'knowledge.manage',
  AssistantUse: 'assistant.use',
  TeamInsightsView: 'team_insights.view',
  TeamInsightsViewOwn: 'team_insights.view_own',
  AuditView: 'audit.view',
  WorkflowManage: 'workflow.manage',
  IntegrationManage: 'integration.manage',
  BrandView: 'brand.view',
  BrandManage: 'brand.manage',
} as const

export type PermissionName = (typeof Permission)[keyof typeof Permission]

const MEMBER: PermissionName[] = [
  Permission.DashboardView,
  Permission.AnalyticsViewOwn,
  Permission.TeamView,
  Permission.TenantView,
  Permission.CompanyView,
  Permission.CompanyCreate,
  Permission.CompanyUpdateOwn,
  Permission.LeadManage,
  Permission.ProspectManage,
  Permission.TaskCreate,
  Permission.TaskViewOwn,
  Permission.TaskUpdateAssigned,
  Permission.ProposalView,
  Permission.ProposalCreate,
  Permission.CommunicationViewOwn,
  Permission.AssistantUse,
  Permission.TeamInsightsViewOwn,
  Permission.BrandView,
]

const ADMIN_DENIED = new Set<PermissionName>([Permission.TenantManage, Permission.TeamChangeRole])

export function hasPermission(role: string | null | undefined, permission: PermissionName): boolean {
  if (role === 'owner') return true
  if (role === 'admin') return !ADMIN_DENIED.has(permission)
  if (role === 'member') return MEMBER.includes(permission)
  return false
}

export function hasAnyPermission(role: string | null | undefined, permissions: readonly PermissionName[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission))
}
