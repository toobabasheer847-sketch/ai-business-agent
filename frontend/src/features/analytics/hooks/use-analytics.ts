import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '@/features/analytics/api/analytics.api'
import type { AnalyticsQuery } from '@/features/analytics/types/analytics.types'

export function useAnalytics(query: AnalyticsQuery, access: { full: boolean; tasks: boolean } = { full: true, tasks: true }) {
  const sales = useQuery({ queryKey: ['analytics', 'sales', query], queryFn: () => analyticsApi.sales(query), enabled: access.full })
  const proposals = useQuery({ queryKey: ['analytics', 'proposals', query], queryFn: () => analyticsApi.proposals(query), enabled: access.full })
  const tasks = useQuery({ queryKey: ['analytics', 'tasks', query], queryFn: () => analyticsApi.tasks(query), enabled: access.tasks })
  const team = useQuery({ queryKey: ['analytics', 'team', query], queryFn: () => analyticsApi.team(query), enabled: access.full })
  const communications = useQuery({ queryKey: ['analytics', 'communications', query], queryFn: () => analyticsApi.communications(query), enabled: access.full })
  const trends = useQuery({ queryKey: ['analytics', 'trends', query], queryFn: () => analyticsApi.trends(query), enabled: access.tasks })
  const insights = useQuery({ queryKey: ['analytics', 'insights', query], queryFn: () => analyticsApi.insights(query), enabled: access.full })
  return { sales, proposals, tasks, team, communications, trends, insights }
}
