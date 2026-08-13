import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'

import { APP_NAME } from '@/lib/constants/app'

export function AuthLayout() {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.95_0.02_250)_0%,_transparent_55%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-md space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            AI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your tenant workspace
          </p>
        </div>
        <Outlet />
      </motion.div>
    </div>
  )
}
