import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createConversationSchema,
  updateConversationSchema,
  type CreateConversationFormValues,
  type UpdateConversationFormValues,
} from '@/features/conversations/schemas/conversation.schemas'
import {
  CONVERSATION_CHANNELS,
  CONVERSATION_STATUSES,
  type Conversation,
} from '@/features/conversations/types/conversation.types'
import type { Prospect } from '@/features/prospects/types/prospect.types'
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

type ConversationFormValues =
  | CreateConversationFormValues
  | UpdateConversationFormValues

type ConversationFormProps = {
  mode: 'create' | 'edit'
  initial?: Conversation | null
  prospects: Prospect[]
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: ConversationFormValues) => Promise<void> | void
  onCancel?: () => void
}

const NONE_PROSPECT = '__none__'

function prospectLabel(prospect: Prospect) {
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(' ')
}

function emptyCreateValues(): CreateConversationFormValues {
  return {
    prospectId: '',
    title: '',
    channel: 'web',
    summary: '',
  }
}

function fromConversation(conversation: Conversation): UpdateConversationFormValues {
  return {
    title: conversation.title ?? '',
    channel: (CONVERSATION_CHANNELS as readonly string[]).includes(
      conversation.channel,
    )
      ? (conversation.channel as UpdateConversationFormValues['channel'])
      : 'web',
    status: (CONVERSATION_STATUSES as readonly string[]).includes(
      conversation.status,
    )
      ? (conversation.status as UpdateConversationFormValues['status'])
      : 'active',
    summary: conversation.summary ?? '',
  }
}

export function ConversationForm({
  mode,
  initial,
  prospects,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: ConversationFormProps) {
  const schema =
    mode === 'create' ? createConversationSchema : updateConversationSchema

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<ConversationFormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === 'edit' && initial
        ? fromConversation(initial)
        : emptyCreateValues(),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        if (mode === 'create') {
          const values = formValues as CreateConversationFormValues
          await onSubmit({
            prospectId: values.prospectId?.trim() ?? '',
            title: values.title?.trim() ?? '',
            channel: values.channel,
            summary: values.summary?.trim() ?? '',
          })
          return
        }

        const values = formValues as UpdateConversationFormValues
        await onSubmit({
          title: values.title?.trim() ?? '',
          channel: values.channel,
          status: values.status,
          summary: values.summary?.trim() ?? '',
        })
      })}
    >
      {mode === 'create' ? (
        <div className="space-y-2">
          <Label htmlFor="conversation-prospect">Prospect</Label>
          <Controller
            name="prospectId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || NONE_PROSPECT}
                onValueChange={(value) =>
                  field.onChange(value === NONE_PROSPECT ? '' : value)
                }
                disabled={submitting}
              >
                <SelectTrigger id="conversation-prospect" className="w-full">
                  <SelectValue placeholder="No prospect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PROSPECT}>No prospect</SelectItem>
                  {prospects.map((prospect) => (
                    <SelectItem key={prospect.id} value={prospect.id}>
                      {prospectLabel(prospect)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {'prospectId' in errors && errors.prospectId && (
            <p className="text-sm text-destructive">
              {errors.prospectId.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Optional. Conversations can be created without a prospect.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="conversation-title">Title</Label>
        <Input
          id="conversation-title"
          disabled={submitting}
          placeholder="Optional title"
          {...register('title')}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="conversation-channel">Channel</Label>
        <Controller
          name="channel"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || 'web'}
              onValueChange={field.onChange}
              disabled={submitting}
            >
              <SelectTrigger id="conversation-channel" className="w-full">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_CHANNELS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.channel && (
          <p className="text-sm text-destructive">{errors.channel.message}</p>
        )}
      </div>

      {mode === 'edit' ? (
        <div className="space-y-2">
          <Label htmlFor="conversation-status">Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'active'}
                onValueChange={field.onChange}
                disabled={submitting}
              >
                <SelectTrigger id="conversation-status" className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {CONVERSATION_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {'status' in errors && errors.status && (
            <p className="text-sm text-destructive">{errors.status.message}</p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="conversation-summary">Summary</Label>
        <Input
          id="conversation-summary"
          disabled={submitting}
          placeholder="Optional summary"
          {...register('summary')}
        />
        {errors.summary && (
          <p className="text-sm text-destructive">{errors.summary.message}</p>
        )}
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
