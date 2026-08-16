import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CircleHelp,
  LayoutDashboard,
  Landmark,
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
  Plug,
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
    title: 'Tenant',
    href: '/tenant',
    icon: Landmark,
    module: 'tenant',
    available: true,
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
    available: false,
  },
  {
    title: 'Proposals',
    href: '/proposals',
    icon: FileText,
    module: 'proposal',
    available: true,
  },
  {
    title: 'Knowledgebase',
    href: '/knowledgebases',
    icon: BookOpen,
    module: 'knowledgebase',
    available: true,
  },
  {
    title: 'Gmail',
    href: '/gmail-configuration',
    icon: Mail,
    module: 'gmail-configuration',
    available: false,
  },
  {
    title: 'Phone Numbers',
    href: '/phone-numbers',
    icon: Phone,
    module: 'phone-number',
    available: true,
  },
  {
    title: 'Twilio Apps',
    href: '/twilio-apps',
    icon: Plug,
    module: 'twilio-app',
    available: true,
  },
  {
    title: 'Users',
    href: '/users',
    icon: BriefcaseBusiness,
    module: 'user',
    available: false,
  },
  {
    title: 'Master Settings',
    href: '/master-settings',
    icon: Settings,
    module: 'master-settings',
    available: true,
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
