import { ApiError } from '@/lib/api'

export function getAssistantErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session expired. Please sign in again.'
    }
    if (error.status === 400) {
      return 'Please enter a valid message.'
    }
    if (error.status >= 500) {
      return 'The assistant could not complete that request. Please try again.'
    }
    if (error.status === 0) {
      return 'Unable to reach the assistant. Check your connection and try again.'
    }
  }

  return 'Unable to reach the assistant. Check your connection and try again.'
}
