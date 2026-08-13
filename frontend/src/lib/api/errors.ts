export type ApiErrorBody = {
  statusCode: number
  timestamp?: string
  path?: string
  message: string | string[] | Record<string, unknown>
  error?: {
    code?: number
    message?: string | string[]
    details?: unknown
    requestId?: string
  }
}

export class ApiError extends Error {
  status: number
  path?: string
  details?: unknown

  constructor(status: number, message: string, path?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.details = details
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

export function normalizeApiError(data: unknown, status: number, path?: string): ApiError {
  const body = data as ApiErrorBody | undefined

  const raw =
    body?.error?.message ??
    body?.message ??
    (status === 401
      ? 'Unauthorized'
      : status === 403
        ? 'Forbidden'
        : `Request failed (${status})`)

  const message = Array.isArray(raw) ? raw.join(', ') : String(raw)

  return new ApiError(status, message, path ?? body?.path, body?.error?.details ?? body)
}
