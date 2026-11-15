import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from '@/features/users/schemas/user.schemas'
import type { User } from '@/features/users/types/user.types'
import { Permission } from '@/features/authorization/permissions'
import { usePermissions } from '@/features/authorization/use-permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type UserFormValues = CreateUserFormValues | UpdateUserFormValues

type UserFormProps = {
  mode: 'create' | 'edit'
  initial?: User | null
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: UserFormValues) => Promise<void> | void
  onCancel?: () => void
}

function emptyValues(): CreateUserFormValues {
  return {
    name: '',
    email: '',
    password: '',
    isActive: true,
    role: 'member',
  }
}

function fromUser(user: User): UpdateUserFormValues {
  return {
    name: user.name,
    email: user.email,
    password: '',
    isActive: user.isActive,
    role: user.role ?? 'member',
  }
}

export function UserForm({
  mode,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const { hasPermission } = usePermissions()
  const canChangeRole = hasPermission(Permission.TeamChangeRole)
  const schema = mode === 'create' ? createUserSchema : updateUserSchema

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === 'edit' && initial ? fromUser(initial) : emptyValues(),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        if (mode === 'create') {
          const values = formValues as CreateUserFormValues
          await onSubmit({
            name: values.name.trim(),
            email: values.email.trim(),
            password: values.password,
            isActive: values.isActive ?? true,
            ...(canChangeRole && values.role ? { role: values.role } : {}),
          })
          return
        }

        const values = formValues as UpdateUserFormValues
        await onSubmit({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password?.trim() || '',
          isActive: values.isActive,
          ...(canChangeRole && values.role ? { role: values.role } : {}),
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="user-name">Name</Label>
        <Input
          id="user-name"
          autoComplete="name"
          disabled={submitting}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="user-email">Email</Label>
        <Input
          id="user-email"
          type="email"
          autoComplete="email"
          disabled={submitting}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="user-password">
          {mode === 'create' ? 'Password' : 'New password'}
        </Label>
        <Input
          id="user-password"
          type="password"
          autoComplete={mode === 'create' ? 'new-password' : 'new-password'}
          disabled={submitting}
          placeholder={
            mode === 'edit' ? 'Leave blank to keep the current password' : undefined
          }
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
        {mode === 'edit' ? (
          <p className="text-xs text-muted-foreground">
            Optional. Leave empty to keep the existing password. Never returned
            by the API.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Minimum 8 characters. The password is hashed server-side and never
            returned.
          </p>
        )}
      </div>

      {canChangeRole ? (
        <div className="space-y-2">
          <Label htmlFor="user-role">Role</Label>
          <select
            id="user-role"
            disabled={submitting}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            {...register('role')}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Only an owner can change roles. The tenant must keep one active owner.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div className="space-y-0.5">
          <Label htmlFor="user-active">Active</Label>
          <p className="text-xs text-muted-foreground">
            Inactive users remain in the tenant but are marked inactive.
          </p>
        </div>
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <Switch
              id="user-active"
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              disabled={submitting}
            />
          )}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
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
    </form>
  )
}
