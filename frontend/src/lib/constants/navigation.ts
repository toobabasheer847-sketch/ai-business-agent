import type { PermissionName } from '@/features/authorization/permissions'
import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  Building2,
  CircleHelp,
  ShieldCheck,
  TriangleAlert,
  Activity,
  BarChart3,
  LayoutDashboard,
  GitBranch,
  Landmark,
  ListTodo,
  Mail,
  MessageSquare,
  Phone,
  Settings,
  Sparkles,
  Users,
  BriefcaseBusiness,
  BookOpen,
  MessagesSquare,
  FileText,
  UserRound,
} from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Backend module this nav maps to */
  module: string
  /** Whether routes are currently live in AppModule */
  available: boolean
  description?: string
  permissions?: PermissionName[]
}

/**
 * Navigation derived from actual backend modules.
 * `available: false` = module exists in codebase but is not imported in AppModule yet.
 */
export const mainNav: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    module: 'app',
    available: true,
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    module: 'analytics',
    available: true,
    description: 'Period comparisons and business insights',
    permissions: ['analytics.view', 'analytics.view_own'],
  },
  {
    title: 'AI Monitoring',
    href: '/ai-monitoring',
    icon: Activity,
    module: 'ai-monitoring',
    available: true,
    description: 'Provider runs, token usage, and estimated cost',
    permissions: ['audit.view', 'assistant.use'],
  },
  {
    title: 'Exception Center',
    href: '/exceptions',
    icon: TriangleAlert,
    module: 'exceptions',
    available: true,
    description: 'Daily operational problems that need a manager',
    permissions: ['audit.view'],
  },
  {
    title: 'Workflows',
    href: '/workflows',
    icon: GitBranch,
    module: 'workflows',
    available: true,
    description: 'Controlled workflow automation',
    permissions: ['workflow.manage'],
  },
  {
    title: 'Workflow analytics',
    href: '/workflow-analytics',
    icon: BarChart3,
    module: 'workflow-analytics',
    available: true,
    description: 'Execution performance and estimated savings',
    permissions: ['workflow.manage'],
  },
  {
    title: 'Business intelligence',
    href: '/business-intelligence',
    icon: Landmark,
    module: 'business-intelligence',
    available: true,
    description: 'Historical performance, forecasts, and risks',
    permissions: ['analytics.view'],
  },
  {
    title: 'Approval Center',
    href: '/approvals',
    icon: ShieldCheck,
    module: 'approvals',
    available: true,
    description: 'Review sensitive AI actions before they run',
    permissions: ['audit.view', 'assistant.use'],
  },
  {
    title: 'AI Assistant',
    href: '/assistant',
    icon: Bot,
    module: 'ai-master',
    available: true,
    description: 'Chat with the Master Agent',
  },
  {
    title: 'Tasks',
    href: '/tasks',
    icon: ListTodo,
    module: 'ai-task',
    available: true,
    description: 'View and manage your tasks',
  },
  {
    title: 'Tenant',
    href: '/tenant',
    icon: Landmark,
    module: 'tenant',
    available: true,
    permissions: ['tenant.manage'],
  },
  {
    title: 'Brand',
    href: '/brands',
    icon: Sparkles,
    module: 'brand',
    available: true,
  },
  {
    title: 'Companies',
    href: '/companies',
    icon: Building2,
    module: 'company',
    available: true,
  },
  {
    title: 'Leads',
    href: '/leads',
    icon: Users,
    module: 'lead',
    available: true,
  },
  {
    title: 'Prospects',
    href: '/prospects',
    icon: UserRound,
    module: 'prospect',
    available: true,
  },
  {
    title: 'Conversations',
    href: '/conversations',
    icon: MessagesSquare,
    module: 'conversation',
    available: true,
  },
  {
    title: 'Communication Hub',
    href: '/communication-hub',
    icon: MessageSquare,
    module: 'communication-hub',
    available: true,
  },
  {
    title: 'Proposals',
    href: '/proposals',
    icon: FileText,
    module: 'proposal',
    available: true,
  },
  {
    title: 'Knowledge Base',
    href: '/knowledgebases',
    icon: BookOpen,
    module: 'knowledgebase',
    available: true,
    permissions: ['knowledge.manage'],
  },
  {
    title: 'Gmail',
    href: '/gmail-configuration',
    icon: Mail,
    module: 'gmail-configuration',
    available: true,
    permissions: ['integration.manage'],
  },
  {
    title: 'Phone Numbers',
    href: '/phone-numbers',
    icon: Phone,
    module: 'phone-number',
    available: true,
    permissions: ['integration.manage'],
  },
  {
    title: 'Team',
    href: '/users',
    icon: BriefcaseBusiness,
    module: 'user',
    available: true,
  },
  {
    title: 'Master Settings',
    href: '/master-settings',
    icon: Settings,
    module: 'master-settings',
    available: true,
    permissions: ['tenant.manage'],
  },
  {
    title: 'System Status',
    href: '/system',
    icon: CircleHelp,
    module: 'integration',
    available: true,
    description: 'Backend connectivity & foundation checks',
  },
]

export const navSections: Array<{ id: string; label: string; hrefs: string[] }> = [
  { id: 'workspace', label: 'Workspace', hrefs: ['/dashboard', '/assistant', '/analytics', '/ai-monitoring', '/exceptions', '/workflows', '/workflow-analytics', '/business-intelligence', '/approvals'] },
  { id: 'crm', label: 'CRM', hrefs: ['/companies', '/leads', '/prospects', '/proposals'] },
  { id: 'work', label: 'Work', hrefs: ['/tasks', '/conversations', '/communication-hub', '/knowledgebases'] },
  { id: 'team', label: 'Team', hrefs: ['/users', '/brands'] },
  { id: 'settings', label: 'Settings', hrefs: ['/gmail-configuration', '/phone-numbers', '/tenant', '/master-settings', '/system'] },
]

/** Named so later phases can add routes. These are not rendered as links. */
export const plannedModules = [
  { id: 'workflows', title: 'Automation Workflows' },
] as const
