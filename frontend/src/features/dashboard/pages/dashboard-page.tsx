import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { mainNav } from '@/lib/constants/navigation'

export function DashboardPage() {
  const { user } = useAuth()
  const available = mainNav.filter((n) => n.available && n.href !== '/dashboard')
  const upcoming = mainNav.filter((n) => !n.available)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${user?.name ? `, ${user.name}` : ''}. Tenant-scoped workspace ready.`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authenticated user</CardTitle>
              <CardDescription>From JWT session /auth/me</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {user?.name}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {user?.email}
              </p>
              <p className="truncate">
                <span className="text-muted-foreground">Tenant:</span> {user?.tenantId}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live backend modules</CardTitle>
              <CardDescription>Currently imported in AppModule</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {available.map((item) => (
                <Badge key={item.href} variant="secondary">
                  {item.title}
                </Badge>
              ))}
              <Badge variant="secondary">Auth</Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Foundation status</CardTitle>
              <CardDescription>Phase 1 setup complete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>React + Vite + Tailwind + shadcn/ui</p>
              <p>TanStack Query + Axios + JWT auth shell</p>
              <p>
                <Link to="/system" className="text-foreground underline-offset-4 hover:underline">
                  Check backend connectivity →
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Modules planned next</CardTitle>
          <CardDescription>
            These exist in the backend codebase but are not yet mounted in AppModule. UI pages will be built module-by-module after approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((item) => (
            <div
              key={item.href}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <item.icon className="size-4 text-muted-foreground" />
              <span>{item.title}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                pending
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
