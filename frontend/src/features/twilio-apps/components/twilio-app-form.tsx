import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'

import {
  createTwilioAppSchema,
  updateTwilioAppSchema,
  type CreateTwilioAppFormValues,
  type UpdateTwilioAppFormValues,
} from '@/features/twilio-apps/schemas/twilio-app.schemas'
import {
  TWILIO_APP_STATUSES,
  type TwilioApp,
} from '@/features/twilio-apps/types/twilio-app.types'
import type { PhoneNumber } from '@/features/phone-numbers/types/phone-number.types'
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

type Mode = 'create' | 'edit'

type TwilioAppFormProps = {
  mode: Mode
  phoneNumbers: PhoneNumber[]
  initial?: TwilioApp | null
  submitting?: boolean
  submitLabel: string
  onSubmit: (
    values: CreateTwilioAppFormValues | UpdateTwilioAppFormValues,
  ) => Promise<void> | void
  onCancel: () => void
}

export function TwilioAppForm({
  mode,
  phoneNumbers,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: TwilioAppFormProps) {
  const [showToken, setShowToken] = useState(false)
  const schema = mode === 'create' ? createTwilioAppSchema : updateTwilioAppSchema

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateTwilioAppFormValues | UpdateTwilioAppFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phoneNumberId: initial?.phoneNumberId ?? '',
      accountSid: initial?.accountSid ?? '',
      authToken: '',
      appSid: initial?.appSid ?? '',
      webhookUrl: initial?.webhookUrl ?? '',
      status:
        (initial?.status as CreateTwilioAppFormValues['status']) ?? 'active',
    },
  })

  const fieldErrors = errors as Record<string, { message?: string } | undefined>

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          accountSid: values.accountSid.trim(),
          authToken: values.authToken?.trim() ?? '',
          appSid: values.appSid?.trim() ?? '',
          webhookUrl: values.webhookUrl?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label>Phone number</Label>
        <Controller
          control={control}
          name="phoneNumberId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a phone number" />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No phone numbers available
                  </SelectItem>
                ) : (
                  phoneNumbers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.phoneNumber}
                      {item.label ? ` — ${item.label}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {fieldErrors.phoneNumberId?.message && (
          <p className="text-sm text-destructive">
            {fieldErrors.phoneNumberId.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Must belong to your tenant. Numbers come from Phone Numbers.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountSid">Account SID</Label>
        <Input
          id="accountSid"
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
          {...register('accountSid')}
        />
        {fieldErrors.accountSid?.message && (
          <p className="text-sm text-destructive">
            {fieldErrors.accountSid.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="authToken">
          Auth Token
          {mode === 'edit' ? (
            <span className="ml-1 font-normal text-muted-foreground">
              (leave blank to keep current)
            </span>
          ) : null}
        </Label>
        <div className="relative">
          <Input
            id="authToken"
            type={showToken ? 'text' : 'password'}
            placeholder={mode === 'edit' ? '••••••••••••••••' : 'Auth token'}
            autoComplete="new-password"
            className="pr-10"
            {...register('authToken')}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setShowToken((v) => !v)}
            aria-label={showToken ? 'Hide auth token' : 'Show auth token'}
          >
            {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        {fieldErrors.authToken?.message && (
          <p className="text-sm text-destructive">
            {fieldErrors.authToken.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="appSid">App SID (optional)</Label>
        <Input
          id="appSid"
          placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
          {...register('appSid')}
        />
        {fieldErrors.appSid?.message && (
          <p className="text-sm text-destructive">{fieldErrors.appSid.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhookUrl">Webhook URL (optional)</Label>
        <Input
          id="webhookUrl"
          placeholder="https://example.com/api/webhooks/twilio/..."
          autoComplete="off"
          {...register('webhookUrl')}
        />
        {fieldErrors.webhookUrl?.message && (
          <p className="text-sm text-destructive">
            {fieldErrors.webhookUrl.message}
          </p>
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
                {TWILIO_APP_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {fieldErrors.status?.message && (
          <p className="text-sm text-destructive">{fieldErrors.status.message}</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || phoneNumbers.length === 0}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
