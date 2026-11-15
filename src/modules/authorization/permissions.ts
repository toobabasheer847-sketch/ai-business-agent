export const TENANT_ROLES = ['owner', 'admin', 'member'] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

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
  IntegrationManage: 'integration.manage',
  BrandView: 'brand.view',
  BrandManage: 'brand.manage',
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

const ALL = Object.values(Permission);

const ADMIN: PermissionName[] = ALL.filter(
  (permission) => permission !== Permission.TenantManage && permission !== Permission.TeamChangeRole,
);

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
];

export const ROLE_PERMISSIONS: Record<TenantRole, ReadonlySet<PermissionName>> = {
  owner: new Set(ALL),
  admin: new Set(ADMIN),
  member: new Set(MEMBER),
};

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === 'string' && (TENANT_ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: unknown, permission: PermissionName): boolean {
  if (!isTenantRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function hasAnyPermission(role: unknown, permissions: readonly PermissionName[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function permissionsForRole(role: unknown): PermissionName[] {
  if (!isTenantRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}
