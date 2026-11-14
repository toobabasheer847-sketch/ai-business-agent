import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '@/features/analytics/api/analytics.api'
import type { AnalyticsQuery } from '@/features/analytics/types/analytics.types'

export function useAnalytics(query: AnalyticsQuery) {
  const sales = useQuery({ queryKey: ['analytics', 'sales', query], queryFn: () => analyticsApi.sales(query) })
  const proposals = useQuery({ queryKey: ['analytics', 'proposals', query], queryFn: () => analyticsApi.proposals(query) })
  const tasks = useQuery({ queryKey: ['analytics', 'tasks', query], queryFn: () => analyticsApi.tasks(query) })
  const team = useQuery({ queryKey: ['analytics', 'team', query], queryFn: () => analyticsApi.team(query) })
  const communications = useQuery({ queryKey: ['analytics', 'communications', query], queryFn: () => analyticsApi.communications(query) })
  const trends = useQuery({ queryKey: ['analytics', 'trends', query], queryFn: () => analyticsApi.trends(query) })
  const insights = useQuery({ queryKey: ['analytics', 'insights', query], queryFn: () => analyticsApi.insights(query) })
  return { sales, proposals, tasks, team, communications, trends, insights }
}
