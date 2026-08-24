import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createProposalSchema,
  updateProposalSchema,
  type CreateProposalFormValues,
  type UpdateProposalFormValues,
} from '@/features/proposals/schemas/proposal.schemas'
import {
  PROPOSAL_STATUSES,
  type Proposal,
} from '@/features/proposals/types/proposal.types'
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

type ProposalFormValues = CreateProposalFormValues | UpdateProposalFormValues

type ProposalFormProps = {
  mode: 'create' | 'edit'
  initial?: Proposal | null
  prospects: Prospect[]
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: ProposalFormValues) => Promise<void> | void
  onCancel?: () => void
}

function prospectLabel(prospect: Prospect) {
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(' ')
}

function emptyValues(): CreateProposalFormValues {
  return {
    prospectId: '',
    title: '',
    description: '',
    content: '',
    status: 'draft',
  }
}

function fromProposal(proposal: Proposal): UpdateProposalFormValues {
  return {
    title: proposal.title,
    description: proposal.description ?? '',
    content: proposal.content ?? '',
    status: (PROPOSAL_STATUSES as readonly string[]).includes(proposal.status)
      ? (proposal.status as UpdateProposalFormValues['status'])
      : 'draft',
  }
}

export function ProposalForm({
  mode,
  initial,
  prospects,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: ProposalFormProps) {
  const schema = mode === 'create' ? createProposalSchema : updateProposalSchema

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === 'edit' && initial ? fromProposal(initial) : emptyValues(),
  })

  const linkedProspect =
    mode === 'edit' && initial
      ? prospects.find((p) => p.id === initial.prospectId)
      : null

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        if (mode === 'create') {
          const values = formValues as CreateProposalFormValues
          await onSubmit({
            prospectId: values.prospectId.trim(),
            title: values.title.trim(),
            description: values.description?.trim() ?? '',
            content: values.content?.trim() ?? '',
            status: values.status,
          })
          return
        }

        const values = formValues as UpdateProposalFormValues
        await onSubmit({
          title: values.title?.trim() ?? '',
          description: values.description?.trim() ?? '',
          content: values.content?.trim() ?? '',
          status: values.status,
        })
      })}
    >
      {mode === 'create' ? (
        <div className="space-y-2">
          <Label htmlFor="proposal-prospect">Prospect</Label>
          <Controller
            name="prospectId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={submitting || prospects.length === 0}
              >
                <SelectTrigger id="proposal-prospect" className="w-full">
                  <SelectValue placeholder="Select a prospect" />
                </SelectTrigger>
                <SelectContent>
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
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Prospect</Label>
          <Input
            value={
              linkedProspect
                ? prospectLabel(linkedProspect)
                : (initial?.prospectId ?? 'Unknown prospect')
            }
            disabled
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            Prospect cannot be changed after creation.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="proposal-title">Title</Label>
        <Input
          id="proposal-title"
          disabled={submitting}
          {...register('title')}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-description">Description</Label>
        <Input
          id="proposal-description"
          disabled={submitting}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-content">Content</Label>
        <textarea
          id="proposal-content"
          rows={5}
          disabled={submitting}
          placeholder="Optional proposal body…"
          className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          {...register('content')}
        />
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-status">Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || 'draft'}
              onValueChange={field.onChange}
              disabled={submitting}
            >
              <SelectTrigger id="proposal-status" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {PROPOSAL_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
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
          disabled={
            submitting ||
            (mode === 'create' && prospects.length === 0) ||
            (mode === 'edit' && !isDirty)
          }
        >
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
