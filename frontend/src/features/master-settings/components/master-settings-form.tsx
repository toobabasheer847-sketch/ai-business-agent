import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  updateMasterSettingsSchema,
  type UpdateMasterSettingsFormValues,
} from '@/features/master-settings/schemas/master-settings.schemas'
import type { MasterSettings } from '@/features/master-settings/types/master-settings.types'
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
import { Switch } from '@/components/ui/switch'

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English (en)' },
  { value: 'en-US', label: 'English US (en-US)' },
  { value: 'en-GB', label: 'English UK (en-GB)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'de', label: 'German (de)' },
  { value: 'ur', label: 'Urdu (ur)' },
] as const

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
] as const

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'PKR', label: 'PKR' },
  { value: 'AED', label: 'AED' },
  { value: 'INR', label: 'INR' },
] as const

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}))

function withCurrentOption(
  options: ReadonlyArray<{ value: string; label: string }>,
  current: string,
) {
  if (!current) return [...options]
  if (options.some((option) => option.value === current)) return [...options]
  return [{ value: current, label: current }, ...options]
}

type MasterSettingsFormProps = {
  settings: MasterSettings
  submitting?: boolean
  onSubmit: (values: UpdateMasterSettingsFormValues) => Promise<void> | void
}

export function MasterSettingsForm({
  settings,
  submitting,
  onSubmit,
}: MasterSettingsFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateMasterSettingsFormValues>({
    resolver: zodResolver(updateMasterSettingsSchema),
    defaultValues: {
      defaultLanguage: settings.defaultLanguage,
      defaultTimezone: settings.defaultTimezone,
      defaultCurrency: settings.defaultCurrency,
      aiModel: settings.aiModel ?? '',
      maxConversationHistory: settings.maxConversationHistory,
      enableNotifications: settings.enableNotifications,
      notificationEmail: settings.notificationEmail ?? '',
      businessHoursStart: settings.businessHoursStart,
      businessHoursEnd: settings.businessHoursEnd,
      isActive: settings.isActive,
    },
  })

  const languageOptions = withCurrentOption(
    LANGUAGE_OPTIONS,
    settings.defaultLanguage,
  )
  const timezoneOptions = withCurrentOption(
    TIMEZONE_OPTIONS,
    settings.defaultTimezone,
  )
  const currencyOptions = withCurrentOption(
    CURRENCY_OPTIONS,
    settings.defaultCurrency,
  )

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values)
      })}
    >
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Locale & region</h3>
          <p className="text-xs text-muted-foreground">
            Default language, timezone, and currency for this tenant.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Language</Label>
            <Controller
              control={control}
              name="defaultLanguage"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.defaultLanguage && (
              <p className="text-sm text-destructive">
                {errors.defaultLanguage.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Controller
              control={control}
              name="defaultTimezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.defaultTimezone && (
              <p className="text-sm text-destructive">
                {errors.defaultTimezone.message}
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Currency</Label>
            <Controller
              control={control}
              name="defaultCurrency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:max-w-xs">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.defaultCurrency && (
              <p className="text-sm text-destructive">
                {errors.defaultCurrency.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">AI settings</h3>
          <p className="text-xs text-muted-foreground">
            Optional model override and conversation history window.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-model">AI model</Label>
            <Input
              id="ai-model"
              placeholder="e.g. gemini-2.0-flash"
              disabled={submitting}
              {...register('aiModel')}
            />
            {errors.aiModel && (
              <p className="text-sm text-destructive">{errors.aiModel.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave blank to use the system default.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-history">Max conversation history</Label>
            <Input
              id="max-history"
              type="number"
              min={1}
              max={100}
              disabled={submitting}
              {...register('maxConversationHistory', { valueAsNumber: true })}
            />
            {errors.maxConversationHistory && (
              <p className="text-sm text-destructive">
                {errors.maxConversationHistory.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Notifications</h3>
          <p className="text-xs text-muted-foreground">
            Tenant-level notification preferences.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="enable-notifications">Enable notifications</Label>
            <p className="text-xs text-muted-foreground">
              Turn email notifications on or off for this tenant.
            </p>
          </div>
          <Controller
            control={control}
            name="enableNotifications"
            render={({ field }) => (
              <Switch
                id="enable-notifications"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={submitting}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notification-email">Notification email</Label>
          <Input
            id="notification-email"
            type="email"
            placeholder="ops@example.com"
            disabled={submitting}
            {...register('notificationEmail')}
          />
          {errors.notificationEmail && (
            <p className="text-sm text-destructive">
              {errors.notificationEmail.message}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Business hours</h3>
          <p className="text-xs text-muted-foreground">
            24-hour format. Start hour must be before end hour.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start hour</Label>
            <Controller
              control={control}
              name="businessHoursStart"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.businessHoursStart && (
              <p className="text-sm text-destructive">
                {errors.businessHoursStart.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>End hour</Label>
            <Controller
              control={control}
              name="businessHoursEnd"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.businessHoursEnd && (
              <p className="text-sm text-destructive">
                {errors.businessHoursEnd.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Status</h3>
          <p className="text-xs text-muted-foreground">
            Activate or deactivate these settings for the tenant.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="is-active">Settings active</Label>
            <p className="text-xs text-muted-foreground">
              When inactive, the tenant settings record remains but is marked inactive.
            </p>
          </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={submitting}
              />
            )}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || !isDirty}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
