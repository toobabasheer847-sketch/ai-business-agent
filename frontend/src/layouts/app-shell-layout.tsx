import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogOut, Menu, PanelLeft } from 'lucide-react'
import { useState } from 'react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { APP_NAME } from '@/lib/constants/app'
import { mainNav } from '@/lib/constants/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {mainNav.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
              !item.available && 'opacity-70',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          <span className="flex-1 truncate">{item.title}</span>
          {!item.available && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              soon
            </Badge>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 px-4 py-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
        AI
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</p>
        <p className="truncate text-xs text-muted-foreground">Tenant workspace</p>
      </div>
    </Link>
  )
}

export function AppShellLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const initials =
    user?.name
      ?.split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  return (
    <div className="flex min-h-svh w-full bg-background">
      <aside
        className={cn(
          'hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarBrand />
        <Separator />
        <ScrollArea className="flex-1">
          {collapsed ? (
            <nav className="flex flex-col items-center gap-1 p-2">
              {mainNav.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  title={item.title}
                  className={({ isActive }) =>
                    cn(
                      'flex size-10 items-center justify-center rounded-lg',
                      isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/70',
                    )
                  }
                >
                  <item.icon className="size-4" />
                </NavLink>
              ))}
            </nav>
          ) : (
            <NavItems />
          )}
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="px-2 pt-2">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBrand />
              <Separator />
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeft className="size-4" />
          </Button>

          <div className="ml-auto flex items-center gap-2">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span>{user?.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Tenant: {user?.tenantId?.slice(0, 8)}…
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/master-settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mx-auto w-full max-w-7xl"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
