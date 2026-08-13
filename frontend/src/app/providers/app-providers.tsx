import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AppQueryProvider } from '@/app/providers/query-provider'
import { UiProvider } from '@/app/providers/ui-provider'
import { AuthProvider } from '@/features/auth/hooks/use-auth'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AppQueryProvider>
        <UiProvider>
          <AuthProvider>{children}</AuthProvider>
        </UiProvider>
      </AppQueryProvider>
    </BrowserRouter>
  )
}
