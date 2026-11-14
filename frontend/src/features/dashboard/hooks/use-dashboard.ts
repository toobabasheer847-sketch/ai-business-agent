import { useQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/features/dashboard/api/dashboard.api'
import type { DashboardRangeQuery } from '@/features/dashboard/types/dashboard.types'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  counts: () => [...dashboardKeys.all, 'counts'] as const,
  phoneNumbers: () => [...dashboardKeys.all, 'phone-numbers'] as const,
  hubStats: () => [...dashboardKeys.all, 'hub-stats'] as const,
  recentConversations: () => [...dashboardKeys.all, 'recent-conversations'] as const,
  masterStatus: () => [...dashboardKeys.all, 'ai-master-status'] as const,
  communicationStatus: () =>
    [...dashboardKeys.all, 'ai-communication-status'] as const,
  home: (query: DashboardRangeQuery) => [...dashboardKeys.all, 'home', query] as const,
}

export function useDashboardCounts(query: DashboardRangeQuery = {}) {
  const overview = useQuery({
    queryKey: [...dashboardKeys.home(query), 'overview'],
    queryFn: () => dashboardApi.overview(query),
    staleTime: 30_000,
  })
  const counts = overview.data?.filtered ?? overview.data?.lifetime

  return {
    overview,
    companies: counts?.companies ?? 0,
    leads: counts?.leads ?? 0,
    prospects: counts?.prospects ?? 0,
    proposals: counts?.proposals ?? 0,
    isLoading: overview.isLoading,
    isError: overview.isError,
    error: overview.error,
  }
}

export function useDashboardPipeline(query: DashboardRangeQuery = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.home(query), 'pipeline'],
    queryFn: () => dashboardApi.salesPipeline(query),
    staleTime: 30_000,
  })
}

export function useDashboardTasks(query: DashboardRangeQuery = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.home(query), 'tasks'],
    queryFn: () => dashboardApi.tasksSummary(query),
    staleTime: 30_000,
  })
}

export function useDashboardActivity(query: DashboardRangeQuery = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.home(query), 'activity'],
    queryFn: () => dashboardApi.recentActivity(query),
    staleTime: 30_000,
  })
}

export function useDashboardCommunications(query: DashboardRangeQuery = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.home(query), 'communications'],
    queryFn: () => dashboardApi.communicationsSummary(query),
    staleTime: 30_000,
  })
}

export function useDashboardPhoneNumbers() {
  return useQuery({
    queryKey: dashboardKeys.phoneNumbers(),
    queryFn: dashboardApi.phoneNumberSummary,
  })
}

export function useDashboardHubStats() {
  return useQuery({
    queryKey: dashboardKeys.hubStats(),
    queryFn: dashboardApi.communicationStats,
  })
}

export function useDashboardRecentConversations() {
  return useQuery({
    queryKey: dashboardKeys.recentConversations(),
    queryFn: () => dashboardApi.recentConversations(5),
  })
}

export function useMasterAgentStatus() {
  return useQuery({
    queryKey: dashboardKeys.masterStatus(),
    queryFn: dashboardApi.masterAgentStatus,
  })
}

export function useCommunicationAgentStatus() {
  return useQuery({
    queryKey: dashboardKeys.communicationStatus(),
    queryFn: dashboardApi.communicationAgentStatus,
  })
}
