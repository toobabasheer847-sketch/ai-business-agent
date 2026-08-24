import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskFormValues,
  type UpdateTaskFormValues,
} from '@/features/tasks/schemas/task.schemas'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
} from '@/features/tasks/types/task.types'
import type { User } from '@/features/users/types/user.types'
import type { Company } from '@/features/companies/types/company.types'
import type { Lead } from '@/features/leads/types/lead.types'
import type { Prospect } from '@/features/prospects/types/prospect.types'

type TaskFormValues = CreateTaskFormValues | UpdateTaskFormValues

type TaskFormProps = {
  mode: 'create' | 'edit'
  initial?: Task | null
  users: User[]
  companies: Company[]
  leads: Lead[]
  prospects: Prospect[]
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: TaskFormValues) => Promise<void> | void
  onCancel?: () => void
}

const UNASSIGNED = 'none'
const UNLINKED = 'none'

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyValues(): CreateTaskFormValues {
  return {
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: '',
    companyId: '',
    prospectId: '',
    leadId: '',
    dueAt: '',
    recurrenceEnabled: false,
    recurrenceInterval: '',
    recurrenceEndsAt: '',
  }
}

function fromTask(task: Task): UpdateTaskFormValues {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assignedTo: task.assignedTo ?? '',
    companyId: task.companyId ?? '',
    prospectId: task.prospectId ?? '',
    leadId: task.leadId ?? '',
    dueAt: toDatetimeLocalValue(task.dueAt),
    recurrenceEnabled: Boolean(task.recurrenceEnabled),
    recurrenceInterval: (task.recurrenceInterval as '' | 'daily' | 'weekly' | 'monthly') || '',
    recurrenceEndsAt: toDatetimeLocalValue(task.recurrenceEndsAt),
  }
}

function userLabel(user: User) {
  return user.name || user.email
}

function personLabel(person: { firstName: string; lastName: string | null; email?: string | null }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return person.email ? `${name} (${person.email})` : name
}

export function TaskForm({
  mode,
  initial,
  users,
  companies,
  leads,
  prospects,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const schema = mode === 'create' ? createTaskSchema : updateTaskSchema

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromTask(initial) : emptyValues(),
  })

  const recurrenceEnabled = watch('recurrenceEnabled')

  const missingAssignee =
    initial?.assignedTo && !users.some((user) => user.id === initial.assignedTo)
      ? initial.assignedTo
      : null
  const missingCompany =
    initial?.companyId &&
    !companies.some((company) => company.id === initial.companyId)
      ? initial.company
      : null
  const missingLead =
    initial?.leadId && !leads.some((lead) => lead.id === initial.leadId)
      ? initial.lead
      : null
  const missingProspect =
    initial?.prospectId &&
    !prospects.some((prospect) => prospect.id === initial.prospectId)
      ? initial.prospect
      : null

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        await onSubmit({
          ...formValues,
          title: formValues.title.trim(),
          description: formValues.description?.trim() ?? '',
          assignedTo: formValues.assignedTo?.trim() ?? '',
          companyId: formValues.companyId?.trim() ?? '',
          prospectId: formValues.prospectId?.trim() ?? '',
          leadId: formValues.leadId?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          disabled={submitting}
          placeholder="Follow up with ABC"
          {...register('title')}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <textarea
          id="task-description"
          rows={4}
          disabled={submitting}
          placeholder="Optional details…"
          className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'medium'}
                onValueChange={field.onChange}
                disabled={submitting}
              >
                <SelectTrigger id="task-priority" className="w-full capitalize">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((item) => (
                    <SelectItem
                      key={item}
                      value={item}
                      className="capitalize"
                    >
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.priority && (
            <p className="text-sm text-destructive">{errors.priority.message}</p>
          )}
        </div>

        {mode === 'edit' ? (
          <div className="space-y-2">
            <Label htmlFor="task-status">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || 'pending'}
                  onValueChange={field.onChange}
                  disabled={submitting}
                >
                  <SelectTrigger id="task-status" className="w-full capitalize">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((item) => (
                      <SelectItem
                        key={item}
                        value={item}
                        className="capitalize"
                      >
                        {item.replaceAll('_', ' ')}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-due-at">Due date</Label>
          <Input
            id="task-due-at"
            type="datetime-local"
            disabled={submitting}
            {...register('dueAt')}
          />
          {errors.dueAt && (
            <p className="text-sm text-destructive">{errors.dueAt.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-assigned-to">Assigned user</Label>
          <Controller
            name="assignedTo"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || UNASSIGNED}
                onValueChange={(value) =>
                  field.onChange(value === UNASSIGNED ? '' : value)
                }
                disabled={submitting}
              >
                <SelectTrigger id="task-assigned-to" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {missingAssignee ? (
                    <SelectItem value={missingAssignee}>
                      {missingAssignee}
                    </SelectItem>
                  ) : null}
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {userLabel(user)}
                      {user.isActive ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.assignedTo && (
            <p className="text-sm text-destructive">
              {errors.assignedTo.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="task-company">Company</Label>
          <Controller
            name="companyId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || UNLINKED}
                onValueChange={(value) =>
                  field.onChange(value === UNLINKED ? '' : value)
                }
                disabled={submitting}
              >
                <SelectTrigger id="task-company" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNLINKED}>None</SelectItem>
                  {missingCompany ? (
                    <SelectItem value={missingCompany.id}>
                      {missingCompany.name}
                    </SelectItem>
                  ) : null}
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-prospect">Prospect</Label>
          <Controller
            name="prospectId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || UNLINKED}
                onValueChange={(value) =>
                  field.onChange(value === UNLINKED ? '' : value)
                }
                disabled={submitting}
              >
                <SelectTrigger id="task-prospect" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNLINKED}>None</SelectItem>
                  {missingProspect ? (
                    <SelectItem value={missingProspect.id}>
                      {missingProspect.name}
                    </SelectItem>
                  ) : null}
                  {prospects.map((prospect) => (
                    <SelectItem key={prospect.id} value={prospect.id}>
                      {personLabel(prospect)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-lead">Lead</Label>
          <Controller
            name="leadId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || UNLINKED}
                onValueChange={(value) =>
                  field.onChange(value === UNLINKED ? '' : value)
                }
                disabled={submitting}
              >
                <SelectTrigger id="task-lead" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNLINKED}>None</SelectItem>
                  {missingLead ? (
                    <SelectItem value={missingLead.id}>
                      {missingLead.name}
                    </SelectItem>
                  ) : null}
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {personLabel(lead)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Recurring task</div>
            <p className="text-xs text-muted-foreground">
              Completing this occurrence schedules the next one.
            </p>
          </div>
          <input
            type="checkbox"
            className="size-4"
            checked={Boolean(recurrenceEnabled)}
            disabled={submitting}
            onChange={(event) => {
              setValue('recurrenceEnabled', event.target.checked, {
                shouldDirty: true,
              })
              if (!event.target.checked) {
                setValue('recurrenceInterval', '', { shouldDirty: true })
                setValue('recurrenceEndsAt', '', { shouldDirty: true })
              } else if (!watch('recurrenceInterval')) {
                setValue('recurrenceInterval', 'weekly', { shouldDirty: true })
              }
            }}
          />
        </div>
        {recurrenceEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-recurrence-interval">Pattern</Label>
              <Controller
                name="recurrenceInterval"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'weekly'}
                    onValueChange={field.onChange}
                    disabled={submitting}
                  >
                    <SelectTrigger id="task-recurrence-interval" className="w-full">
                      <SelectValue placeholder="Interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-recurrence-ends">Ends at (optional)</Label>
              <Input
                id="task-recurrence-ends"
                type="datetime-local"
                disabled={submitting}
                {...register('recurrenceEndsAt')}
              />
            </div>
          </div>
        ) : null}
        {initial?.nextOccurrenceAt ? (
          <p className="text-xs text-muted-foreground">
            Next occurrence after completion:{' '}
            {new Date(initial.nextOccurrenceAt).toLocaleString()}
          </p>
        ) : null}
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
