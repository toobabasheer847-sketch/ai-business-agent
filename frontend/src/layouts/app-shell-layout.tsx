import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, PanelLeft, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Permission } from '@/features/authorization/permissions'
import { usePermissions } from '@/features/authorization/use-permissions'
import { approvalsApi } from '@/features/approvals/api/approvals.api'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { APP_NAME } from '@/lib/constants/app'
import { mainNav, navSections, type NavItem } from '@/lib/constants/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

function useVisibleNav() {
  const { canAccess, isBootstrapping } = usePermissions()
  if (isBootstrapping) return []
  return mainNav.filter((item) => canAccess(item.permissions))
}

function NavItems({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const items = useVisibleNav()
  const { canAccess } = usePermissions()
  const pending = useQuery({
    queryKey: ['approvals', 'summary'],
    queryFn: approvalsApi.summary,
    enabled: canAccess(['audit.view', 'assistant.use']),
  })
  const pendingCount = pending.data?.pending ?? 0
  const byHref = new Map(items.map((item) => [item.href, item]))

  return (
    <nav className={cn('flex flex-col gap-4', collapsed ? 'items-center p-2' : 'p-3')}>
      {navSections.map((section) => {
        const sectionItems = section.hrefs
          .map((href) => byHref.get(href))
          .filter((item): item is NavItem => Boolean(item))
        if (!sectionItems.length) return null
        return (
          <div key={section.id} className="flex w-full flex-col gap-1">
            {collapsed ? null : (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
            )}
            {sectionItems.map((item) => {
              const link = (
                <NavLink
                  key={item.href}
                  to={item.href}
                  title={collapsed ? item.title : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg text-sm transition-colors',
                      collapsed ? 'size-10 justify-center' : 'min-h-10 px-3',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {collapsed ? <span className="sr-only">{item.title}</span> : <span className="truncate">{item.title}</span>}
                  {item.href === '/approvals' && pendingCount > 0 ? (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{pendingCount}</span>
                  ) : null}
                </NavLink>
              )
              if (!collapsed) return link
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/dashboard" className={cn('flex items-center gap-2 px-4 py-4', collapsed && 'justify-center px-2')}>
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
        AI
      </div>
      {collapsed ? null : (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</p>
          <p className="truncate text-xs text-muted-foreground">Operations</p>
        </div>
      )}
    </Link>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function ShellHeader({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { hasPermission } = usePermissions()
  const items = useVisibleNav()
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((item) =>
    location.pathname === item.href || location.pathname.startsWith(`${item.href}/`),
  )
  const initials =
    user?.name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur md:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobile} aria-label="Open navigation">
        <Menu className="size-4" />
      </Button>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Workspace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {current && current.href !== '/dashboard' ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{current.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" aria-label="Account menu">
              <Avatar className="size-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span>{user?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hasPermission(Permission.TenantManage) ? (
              <DropdownMenuItem onClick={() => navigate('/master-settings')}>Account settings</DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function AppShellLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex md:flex-col',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <Separator />
        <ScrollArea className="min-h-0 flex-1">
          <NavItems collapsed={collapsed} />
        </ScrollArea>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn('w-full', !collapsed && 'justify-start')}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="size-4" />
            {collapsed ? null : <span>Collapse</span>}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarBrand />
          <Separator />
          <NavItems onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ShellHeader onOpenMobile={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
