import { useMutation } from '@tanstack/react-query'

import { assistantApi } from '@/features/assistant/api/assistant.api'

export function useSendAssistantMessage() {
  return useMutation({
    mutationFn: (message: string) => assistantApi.chat(message),
  })
}
