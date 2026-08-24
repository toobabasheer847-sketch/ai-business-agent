import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { brandsApi } from '@/features/brands/api/brands.api'
import type {
  CreateBrandRequest,
  UpdateBrandRequest,
} from '@/features/brands/types/brand.types'

export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: () => [...brandKeys.lists()] as const,
  details: () => [...brandKeys.all, 'detail'] as const,
  detail: (id: string) => [...brandKeys.details(), id] as const,
}

/** Current tenant brand list (0–1 item). Prefer this for the Brand settings page. */
export function useBrands() {
  return useQuery({
    queryKey: brandKeys.list(),
    queryFn: () => brandsApi.list(),
  })
}

export function useBrand(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: brandKeys.detail(id ?? ''),
    queryFn: () => brandsApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateBrand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateBrandRequest) => brandsApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: brandKeys.lists() })
      queryClient.setQueryData(brandKeys.detail(data.id), data)
    },
  })
}

export function useUpdateBrand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateBrandRequest
    }) => brandsApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: brandKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: brandKeys.detail(data.id),
      })
      queryClient.setQueryData(brandKeys.detail(data.id), data)
    },
  })
}

export function useDeleteBrand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => brandsApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: brandKeys.lists() })
      queryClient.removeQueries({ queryKey: brandKeys.detail(id) })
    },
  })
}
