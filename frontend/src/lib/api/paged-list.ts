import { apiClient } from '@/lib/api/client'

type PageResult<T> = {
  data: T[]
  page: number
  limit: number
  total: number
}

const PAGE_SIZE = 100
const MAX_PAGES = 50

function isPage<T>(value: T[] | PageResult<T>): value is PageResult<T> {
  return !Array.isArray(value) && Array.isArray(value?.data)
}

/**
 * Loads a tenant list in bounded pages and returns the same array the screens already use.
 * Stops after 50 pages so one screen cannot request an unbounded series.
 */
export async function listAllPages<T>(
  path: string,
  params?: Record<string, string | boolean | undefined>,
): Promise<T[]> {
  const base: Record<string, string | boolean> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') base[key] = value
  }

  const first = await apiClient.get<T[] | PageResult<T>>(path, {
    params: { ...base, page: 1, limit: PAGE_SIZE },
  })
  if (Array.isArray(first.data)) return first.data

  const items = [...first.data.data]
  const pages = Math.min(MAX_PAGES, Math.ceil(first.data.total / first.data.limit))
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiClient.get<PageResult<T>>(path, {
      params: { ...base, page, limit: PAGE_SIZE },
    })
    items.push(...next.data.data)
  }
  return items
}

export function isPageResult<T>(value: unknown): value is PageResult<T> {
  return isPage(value as T[] | PageResult<T>)
}
