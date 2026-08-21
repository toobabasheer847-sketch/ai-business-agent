import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { tasksApi } from '@/features/tasks/api/tasks.api'
import type {
  CreateTaskRequest,
  TaskListQuery,
  UpdateTaskRequest,
} from '@/features/tasks/types/task.types'

function normalizeListQuery(query?: TaskListQuery): TaskListQuery | undefined {
  if (!query) return undefined

  const normalized: TaskListQuery = {
    status: query.status || undefined,
    priority: query.priority || undefined,
    search: query.search?.trim() || undefined,
    companyId: query.companyId || undefined,
    prospectId: query.prospectId || undefined,
    leadId: query.leadId || undefined,
  }

  if (
    !normalized.status &&
    !normalized.priority &&
    !normalized.search &&
    !normalized.companyId &&
    !normalized.prospectId &&
    !normalized.leadId
  ) {
    return undefined
  }

  return normalized
}

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (query?: TaskListQuery) =>
    [...taskKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
}

async function invalidateTaskQueries(queryClient: QueryClient, taskId?: string) {
  await queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
  if (taskId) {
    await queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
  }
}

export function useTasks(query?: TaskListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: taskKeys.list(normalized),
    queryFn: () => tasksApi.list(normalized),
  })
}

export function useTask(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => tasksApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateTaskRequest) => tasksApi.create(payload),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateTaskRequest
    }) => tasksApi.update(id, payload),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.id)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.id)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.cancel(id),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.id)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: async (_data, id) => {
      await invalidateTaskQueries(queryClient)
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) })
    },
  })
}
