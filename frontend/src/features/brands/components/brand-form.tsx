import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createBrandSchema,
  updateBrandSchema,
  type CreateBrandFormValues,
  type UpdateBrandFormValues,
} from '@/features/brands/schemas/brand.schemas'
import type { Brand } from '@/features/brands/types/brand.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type BrandFormValues = CreateBrandFormValues | UpdateBrandFormValues

type BrandFormProps = {
  mode: 'create' | 'edit'
  initial?: Brand | null
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: BrandFormValues) => Promise<void> | void
  onCancel?: () => void
  onValuesChange?: (values: BrandFormValues) => void
  secondaryAction?: ReactNode
}

function emptyValues(): BrandFormValues {
  return {
    name: '',
    logoUrl: '',
    domain: '',
    apiUrl: '',
    phone: '',
  }
}

function fromBrand(brand: Brand): BrandFormValues {
  return {
    name: brand.name,
    logoUrl: brand.logoUrl ?? '',
    domain: brand.domain ?? '',
    apiUrl: brand.apiUrl ?? '',
    phone: brand.phone ?? '',
  }
}

export function BrandForm({
  mode,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  onValuesChange,
  secondaryAction,
}: BrandFormProps) {
  const schema = mode === 'create' ? createBrandSchema : updateBrandSchema

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromBrand(initial) : emptyValues(),
  })

  const values = watch()

  useEffect(() => {
    const subscription = watch((next) => {
      onValuesChange?.(next as BrandFormValues)
    })
    onValuesChange?.(values)
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial sync once; subscription handles updates
  }, [watch, onValuesChange])

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (formValues) => {
        await onSubmit({
          name: formValues.name.trim(),
          logoUrl: formValues.logoUrl?.trim() ?? '',
          domain: formValues.domain?.trim() ?? '',
          apiUrl: formValues.apiUrl?.trim() ?? '',
          phone: formValues.phone?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="brand-name">Name</Label>
        <Input
          id="brand-name"
          autoComplete="organization"
          disabled={submitting}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-logo-url">Logo URL</Label>
        <Input
          id="brand-logo-url"
          type="url"
          placeholder="https://example.com/logo.png"
          disabled={submitting}
          {...register('logoUrl')}
        />
        {errors.logoUrl && (
          <p className="text-sm text-destructive">{errors.logoUrl.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Paste an image URL. File upload is not supported.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-domain">Domain</Label>
        <Input
          id="brand-domain"
          placeholder="example.com"
          disabled={submitting}
          {...register('domain')}
        />
        {errors.domain && (
          <p className="text-sm text-destructive">{errors.domain.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-api-url">API URL</Label>
        <Input
          id="brand-api-url"
          type="url"
          placeholder="https://api.example.com"
          disabled={submitting}
          {...register('apiUrl')}
        />
        {errors.apiUrl && (
          <p className="text-sm text-destructive">{errors.apiUrl.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-phone">Phone</Label>
        <Input
          id="brand-phone"
          type="tel"
          placeholder="+15551234567"
          disabled={submitting}
          {...register('phone')}
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">{secondaryAction}</div>
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={submitting || (mode === 'edit' && !isDirty)}
          >
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
