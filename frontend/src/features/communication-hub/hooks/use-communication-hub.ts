import { useQuery } from '@tanstack/react-query'

import { communicationHubApi } from '@/features/communication-hub/api/communication-hub.api'
import type {
  CommunicationHubListQuery,
  CommunicationHubThreadQuery,
} from '@/features/communication-hub/types/communication-hub.types'

function normalizeListQuery(query: CommunicationHubListQuery = {}) {
  return {
    channel: query.channel && query.channel !== 'all' ? query.channel : undefined,
    prospectId: query.prospectId?.trim() || undefined,
    search: query.search?.trim() || undefined,
    page: query.page,
    limit: query.limit,
  }
}

function normalizeThreadQuery(query: CommunicationHubThreadQuery = {}) {
  return {
    prospectId: query.prospectId?.trim() || undefined,
    search: query.search?.trim() || undefined,
    page: query.page,
    limit: query.limit,
  }
}

export const communicationHubKeys = {
  all: ['communication-hub'] as const,
  list: (query: CommunicationHubListQuery = {}) =>
    [...communicationHubKeys.all, 'list', normalizeListQuery(query)] as const,
  stats: () => [...communicationHubKeys.all, 'stats'] as const,
  emailThreads: (query: CommunicationHubThreadQuery = {}) =>
    [...communicationHubKeys.all, 'email-threads', normalizeThreadQuery(query)] as const,
  smsThreads: (query: CommunicationHubThreadQuery = {}) =>
    [...communicationHubKeys.all, 'sms-threads', normalizeThreadQuery(query)] as const,
  detail: (id: string) => [...communicationHubKeys.all, 'detail', id] as const,
}

export function useCommunicationHubHistory(query: CommunicationHubListQuery = {}) {
  return useQuery({
    queryKey: communicationHubKeys.list(query),
    queryFn: () => communicationHubApi.list(query),
  })
}

export function useCommunicationHubStats() {
  return useQuery({
    queryKey: communicationHubKeys.stats(),
    queryFn: () => communicationHubApi.stats(),
  })
}

export function useCommunicationHubEmailThreads(
  query: CommunicationHubThreadQuery = {},
) {
  return useQuery({
    queryKey: communicationHubKeys.emailThreads(query),
    queryFn: () => communicationHubApi.getEmailThreads(query),
  })
}

export function useCommunicationHubSmsThreads(
  query: CommunicationHubThreadQuery = {},
) {
  return useQuery({
    queryKey: communicationHubKeys.smsThreads(query),
    queryFn: () => communicationHubApi.getSmsThreads(query),
  })
}

export function useCommunicationHubDetail(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: communicationHubKeys.detail(id ?? ''),
    queryFn: () => communicationHubApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}
