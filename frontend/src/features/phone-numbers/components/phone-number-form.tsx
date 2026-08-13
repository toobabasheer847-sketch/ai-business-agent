import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  phoneNumberFormSchema,
  type PhoneNumberFormValues,
} from '@/features/phone-numbers/schemas/phone-number.schemas'
import {
  PHONE_NUMBER_PROVIDERS,
  PHONE_NUMBER_STATUSES,
  type PhoneNumber,
} from '@/features/phone-numbers/types/phone-number.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type PhoneNumberFormProps = {
  initial?: PhoneNumber | null
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: PhoneNumberFormValues) => Promise<void> | void
  onCancel: () => void
}

export function PhoneNumberForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: PhoneNumberFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PhoneNumberFormValues>({
    resolver: zodResolver(phoneNumberFormSchema),
    defaultValues: {
      phoneNumber: initial?.phoneNumber ?? '',
      label: initial?.label ?? '',
      provider: (initial?.provider as PhoneNumberFormValues['provider']) ?? 'twilio',
      status: (initial?.status as PhoneNumberFormValues['status']) ?? 'active',
    },
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          label: values.label?.trim() ? values.label.trim() : '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone number</Label>
        <Input
          id="phoneNumber"
          placeholder="+923001234567"
          autoComplete="tel"
          {...register('phoneNumber')}
        />
        {errors.phoneNumber && (
          <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
        )}
        <p className="text-xs text-muted-foreground">E.164 format required (e.g. +14155552671)</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          placeholder="Support Line"
          {...register('label')}
        />
        {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Controller
            control={control}
            name="provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_NUMBER_PROVIDERS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.provider && (
            <p className="text-sm text-destructive">{errors.provider.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_NUMBER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.status && (
            <p className="text-sm text-destructive">{errors.status.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
