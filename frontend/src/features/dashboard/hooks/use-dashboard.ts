import { useQueries, useQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/features/dashboard/api/dashboard.api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  counts: () => [...dashboardKeys.all, 'counts'] as const,
  phoneNumbers: () => [...dashboardKeys.all, 'phone-numbers'] as const,
  hubStats: () => [...dashboardKeys.all, 'hub-stats'] as const,
  recentConversations: () => [...dashboardKeys.all, 'recent-conversations'] as const,
  masterStatus: () => [...dashboardKeys.all, 'ai-master-status'] as const,
  communicationStatus: () =>
    [...dashboardKeys.all, 'ai-communication-status'] as const,
}

export function useDashboardCounts() {
  return useQueries({
    queries: [
      {
        queryKey: [...dashboardKeys.counts(), 'companies'],
        queryFn: dashboardApi.countCompanies,
      },
      {
        queryKey: [...dashboardKeys.counts(), 'leads'],
        queryFn: dashboardApi.countLeads,
      },
      {
        queryKey: [...dashboardKeys.counts(), 'prospects'],
        queryFn: dashboardApi.countProspects,
      },
      {
        queryKey: [...dashboardKeys.counts(), 'proposals'],
        queryFn: dashboardApi.countProposals,
      },
      {
        queryKey: [...dashboardKeys.counts(), 'conversations'],
        queryFn: dashboardApi.countConversations,
      },
      {
        queryKey: [...dashboardKeys.counts(), 'knowledgebases'],
        queryFn: dashboardApi.countKnowledgebases,
      },
      {
        queryKey: [...dashboardKeys.counts(), 'users'],
        queryFn: dashboardApi.countUsers,
      },
    ],
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
