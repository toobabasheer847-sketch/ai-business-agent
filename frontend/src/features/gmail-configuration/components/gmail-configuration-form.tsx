import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createGmailConfigurationSchema,
  type CreateGmailConfigurationFormValues,
} from '@/features/gmail-configuration/schemas/gmail-configuration.schemas'
import type { GmailConfiguration } from '@/features/gmail-configuration/types/gmail-configuration.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

type GmailConfigurationFormProps = {
  initialData?: GmailConfiguration
  submitting?: boolean
  onSubmit: (values: CreateGmailConfigurationFormValues) => Promise<void> | void
}

export function GmailConfigurationForm({
  initialData,
  submitting,
  onSubmit,
}: GmailConfigurationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CreateGmailConfigurationFormValues>({
    resolver: zodResolver(createGmailConfigurationSchema),
    defaultValues: {
      email: initialData?.email || '',
      clientId: initialData?.clientId || '',
      isActive: initialData?.isActive ?? true,
    },
  })

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="gmail-email">Gmail email address</Label>
        <Input
          id="gmail-email"
          type="email"
          placeholder="name@gmail.com"
          disabled={submitting}
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        <p className="text-xs text-muted-foreground">
          The Gmail account to be configured for this workspace.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gmail-client-id">Google OAuth2 Client ID</Label>
        <Input
          id="gmail-client-id"
          type="text"
          placeholder="Your Google Cloud Console Client ID"
          disabled={submitting}
          {...register('clientId')}
        />
        {errors.clientId && (
          <p className="text-sm text-destructive">{errors.clientId.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Available from Google Cloud Console. Optional if using OAuth flow.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id="gmail-active" {...register('isActive')} defaultChecked />
          <Label htmlFor="gmail-active" className="cursor-pointer font-normal">
            Active configuration
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          When active, this Gmail configuration is used for sending and receiving messages.
        </p>
      </div>

      <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
        <strong>Security note:</strong> OAuth tokens (access token, refresh token) and client
        secret are stored securely on the backend and never exposed to the frontend.
      </p>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || (!initialData && !isDirty)}>
          {submitting ? 'Saving…' : 'Save configuration'}
        </Button>
      </div>
    </form>
  )
}
