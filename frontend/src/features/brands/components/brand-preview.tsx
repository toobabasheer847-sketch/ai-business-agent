import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

type BrandPreviewProps = {
  name?: string
  logoUrl?: string | null
  domain?: string | null
  phone?: string | null
  className?: string
}

export function BrandPreview({
  name,
  logoUrl,
  domain,
  phone,
  className,
}: BrandPreviewProps) {
  const [logoFailed, setLogoFailed] = useState(false)
  const trimmedLogo = logoUrl?.trim() ?? ''
  const showLogo = Boolean(trimmedLogo) && !logoFailed
  const displayName = name?.trim() || 'Brand name'

  useEffect(() => {
    setLogoFailed(false)
  }, [trimmedLogo])

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-muted/30 p-5 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
        {showLogo ? (
          <img
            src={trimmedLogo}
            alt={displayName}
            className="size-full object-contain p-1.5"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Sparkles className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="truncate text-base font-semibold tracking-tight">{displayName}</p>
        {domain?.trim() ? (
          <p className="truncate text-sm text-muted-foreground">{domain.trim()}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No domain set</p>
        )}
        {phone?.trim() ? (
          <p className="truncate text-sm text-muted-foreground">{phone.trim()}</p>
        ) : null}
        {trimmedLogo && logoFailed ? (
          <p className="text-xs text-destructive">Logo URL could not be loaded</p>
        ) : null}
      </div>
    </div>
  )
}
