import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'

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
  onDisconnectTwilio?: () => void
  disconnecting?: boolean
}

export function PhoneNumberForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  onDisconnectTwilio,
  disconnecting,
}: PhoneNumberFormProps) {
  const [showToken, setShowToken] = useState(false)
  const isEdit = Boolean(initial)

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
      twilioSid: initial?.twilioSid ?? '',
      authToken: '',
      appSid: initial?.appSid ?? '',
      webhookUrl: initial?.webhookUrl ?? '',
    },
  })

  const hasTwilioConfig = Boolean(
    initial?.twilioSid || initial?.appSid || initial?.webhookUrl || initial?.hasAuthToken,
  )

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          label: values.label?.trim() ? values.label.trim() : '',
          twilioSid: values.twilioSid?.trim() ?? '',
          authToken: values.authToken?.trim() ?? '',
          appSid: values.appSid?.trim() ?? '',
          webhookUrl: values.webhookUrl?.trim() ?? '',
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

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <h3 className="text-sm font-medium">Twilio configuration</h3>
          <p className="text-xs text-muted-foreground">
            Stored on this phone number. Auth Token is never returned after save.
          </p>
        </div>

        {initial?.phoneSid ? (
          <div className="space-y-1">
            <Label>Phone SID</Label>
            <p className="break-all font-mono text-xs text-muted-foreground">{initial.phoneSid}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="twilioSid">Account SID</Label>
          <Input
            id="twilioSid"
            autoComplete="off"
            placeholder="ACxxxxxxxx"
            {...register('twilioSid')}
          />
          {errors.twilioSid && (
            <p className="text-sm text-destructive">{errors.twilioSid.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="authToken">Auth Token</Label>
          <div className="relative">
            <Input
              id="authToken"
              type={showToken ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={
                isEdit && initial?.hasAuthToken
                  ? 'Leave blank to keep the current token'
                  : 'Twilio Auth Token'
              }
              className="pr-10"
              {...register('authToken')}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setShowToken((value) => !value)}
              aria-label={showToken ? 'Hide auth token' : 'Show auth token'}
            >
              {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          {errors.authToken && (
            <p className="text-sm text-destructive">{errors.authToken.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="appSid">App SID</Label>
          <Input id="appSid" autoComplete="off" placeholder="APxxxxxxxx" {...register('appSid')} />
          {errors.appSid && (
            <p className="text-sm text-destructive">{errors.appSid.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            type="url"
            placeholder="https://example.com/api/webhooks/twilio/call/inbound"
            {...register('webhookUrl')}
          />
          {errors.webhookUrl && (
            <p className="text-sm text-destructive">{errors.webhookUrl.message}</p>
          )}
        </div>

        {isEdit && hasTwilioConfig && onDisconnectTwilio ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting || disconnecting}
            onClick={onDisconnectTwilio}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect Twilio'}
          </Button>
        ) : null}
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
