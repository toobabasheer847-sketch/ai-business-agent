import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createNestedMessageSchema,
  type CreateNestedMessageFormValues,
} from '@/features/conversations/schemas/conversation.schemas'
import { MESSAGE_ROLES } from '@/features/conversations/types/conversation.types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MessageComposerProps = {
  submitting?: boolean
  onSubmit: (values: CreateNestedMessageFormValues) => Promise<void> | void
}

export function MessageComposer({ submitting, onSubmit }: MessageComposerProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateNestedMessageFormValues>({
    resolver: zodResolver(createNestedMessageSchema),
    defaultValues: {
      role: 'user',
      content: '',
    },
  })

  return (
    <form
      className="space-y-3 rounded-xl border p-3"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          role: values.role,
          content: values.content.trim(),
        })
        reset({ role: values.role, content: '' })
      })}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2 sm:w-[140px]">
          <Label htmlFor="message-role">Role</Label>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={submitting}
              >
                <SelectTrigger id="message-role" className="w-full">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.role && (
            <p className="text-sm text-destructive">{errors.role.message}</p>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="message-content">Message</Label>
          <textarea
            id="message-content"
            rows={3}
            disabled={submitting}
            placeholder="Write a message…"
            className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            {...register('content')}
          />
          {errors.content && (
            <p className="text-sm text-destructive">{errors.content.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  )
}
