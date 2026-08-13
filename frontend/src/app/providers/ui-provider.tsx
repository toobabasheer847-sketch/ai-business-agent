import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import type { ReactNode } from 'react'

export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <Toaster richColors position="top-right" closeButton />
    </TooltipProvider>
  )
}
