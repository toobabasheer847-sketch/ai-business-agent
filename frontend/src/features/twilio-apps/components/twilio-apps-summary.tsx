import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock3, Plug } from 'lucide-react'

import type { TwilioApp } from '@/features/twilio-apps/types/twilio-app.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type TwilioAppsSummaryProps = {
  items: TwilioApp[]
  loading?: boolean
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  delay,
}: {
  title: string
  value: number
  icon: typeof Plug
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function TwilioAppsSummary({ items, loading }: TwilioAppsSummaryProps) {
  const stats = useMemo(() => {
    const total = items.length
    const active = items.filter((item) => item.status === 'active').length
    const inactive = items.filter((item) => item.status === 'inactive').length
    const pendingOrError = items.filter(
      (item) => item.status === 'pending' || item.status === 'error',
    ).length
    return { total, active, inactive, pendingOrError }
  }, [items])

  if (loading) {
    return (
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Total Apps" value={stats.total} icon={Plug} delay={0.02} />
      <SummaryCard
        title="Active"
        value={stats.active}
        icon={CheckCircle2}
        delay={0.05}
      />
      <SummaryCard
        title="Inactive"
        value={stats.inactive}
        icon={Clock3}
        delay={0.08}
      />
      <SummaryCard
        title="Pending / Error"
        value={stats.pendingOrError}
        icon={AlertCircle}
        delay={0.11}
      />
    </div>
  )
}
