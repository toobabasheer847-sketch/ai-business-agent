import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  updateTenantSchema,
  type UpdateTenantFormValues,
} from '@/features/tenant/schemas/tenant.schemas'
import type { Tenant } from '@/features/tenant/types/tenant.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TenantFormProps = {
  tenant: Tenant
  submitting?: boolean
  onSubmit: (values: UpdateTenantFormValues) => Promise<void> | void
}

export function TenantForm({ tenant, submitting, onSubmit }: TenantFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateTenantFormValues>({
    resolver: zodResolver(updateTenantSchema),
    defaultValues: {
      name: tenant.name,
    },
  })

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({ name: values.name.trim() })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="tenant-name">Tenant name</Label>
        <Input
          id="tenant-name"
          autoComplete="organization"
          disabled={submitting}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Display name for your organization. 2–255 characters.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || !isDirty}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
