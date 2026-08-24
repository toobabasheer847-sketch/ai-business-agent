import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createLeadSchema,
  updateLeadSchema,
  type CreateLeadFormValues,
  type UpdateLeadFormValues,
} from '@/features/leads/schemas/lead.schemas'
import { LEAD_STATUSES, type Lead } from '@/features/leads/types/lead.types'
import type { Company } from '@/features/companies/types/company.types'
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

type LeadFormValues = CreateLeadFormValues | UpdateLeadFormValues

type LeadFormProps = {
  mode: 'create' | 'edit'
  initial?: Lead | null
  companies: Company[]
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: LeadFormValues) => Promise<void> | void
  onCancel?: () => void
}

function emptyValues(): CreateLeadFormValues {
  return {
    companyId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    source: '',
    status: 'new',
    notes: '',
  }
}

function fromLead(lead: Lead): CreateLeadFormValues {
  return {
    companyId: lead.companyId,
    firstName: lead.firstName,
    lastName: lead.lastName ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    jobTitle: lead.jobTitle ?? '',
    source: lead.source ?? '',
    status: (LEAD_STATUSES as readonly string[]).includes(lead.status)
      ? (lead.status as CreateLeadFormValues['status'])
      : 'new',
    notes: lead.notes ?? '',
  }
}

export function LeadForm({
  mode,
  initial,
  companies,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: LeadFormProps) {
  const schema = mode === 'create' ? createLeadSchema : updateLeadSchema

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromLead(initial) : emptyValues(),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        await onSubmit({
          companyId: formValues.companyId?.trim() ?? '',
          firstName: formValues.firstName?.trim() ?? '',
          lastName: formValues.lastName?.trim() ?? '',
          email: formValues.email?.trim() ?? '',
          phone: formValues.phone?.trim() ?? '',
          jobTitle: formValues.jobTitle?.trim() ?? '',
          source: formValues.source?.trim() ?? '',
          status: formValues.status,
          notes: formValues.notes?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="lead-company">Company</Label>
        <Controller
          name="companyId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
              disabled={submitting || companies.length === 0}
            >
              <SelectTrigger id="lead-company" className="w-full">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.companyId && (
          <p className="text-sm text-destructive">{errors.companyId.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead-first-name">First name</Label>
          <Input
            id="lead-first-name"
            autoComplete="given-name"
            disabled={submitting}
            {...register('firstName')}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lead-last-name">Last name</Label>
          <Input
            id="lead-last-name"
            autoComplete="family-name"
            disabled={submitting}
            {...register('lastName')}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-email">Email</Label>
        <Input
          id="lead-email"
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
        <Label htmlFor="lead-phone">Phone</Label>
        <Input
          id="lead-phone"
          type="tel"
          autoComplete="tel"
          disabled={submitting}
          {...register('phone')}
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-job-title">Job title</Label>
        <Input
          id="lead-job-title"
          disabled={submitting}
          {...register('jobTitle')}
        />
        {errors.jobTitle && (
          <p className="text-sm text-destructive">{errors.jobTitle.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead-source">Source</Label>
          <Input
            id="lead-source"
            placeholder="website, referral, …"
            disabled={submitting}
            {...register('source')}
          />
          {errors.source && (
            <p className="text-sm text-destructive">{errors.source.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lead-status">Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'new'}
                onValueChange={field.onChange}
                disabled={submitting}
              >
                <SelectTrigger id="lead-status" className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((item) => (
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-notes">Notes</Label>
        <Input id="lead-notes" disabled={submitting} {...register('notes')} />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
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
