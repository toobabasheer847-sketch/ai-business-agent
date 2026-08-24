import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type DashboardKpiCardProps = {
  title: string
  value?: number
  description?: string
  icon: LucideIcon
  href?: string
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  delay?: number
}

export function DashboardKpiCard({
  title,
  value,
  description,
  icon: Icon,
  href,
  isLoading,
  isError,
  errorMessage,
  delay = 0,
}: DashboardKpiCardProps) {
  const content = (
    <Card className={cn('h-full transition-colors', href && 'hover:bg-muted/40')}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-md border bg-background p-1.5 text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : isError ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Unavailable</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {errorMessage ?? 'Could not load this metric.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {value ?? 0}
            </p>
            {description ? (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      {href && !isError ? (
        <Link to={href} className="block h-full focus-visible:outline-none">
          {content}
        </Link>
      ) : (
        content
      )}
    </motion.div>
  )
}
