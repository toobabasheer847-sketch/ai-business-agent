import { Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Users } from 'lucide-react'

import {
  createProspectSchema,
  updateProspectSchema,
  type CreateProspectFormValues,
  type UpdateProspectFormValues,
} from '@/features/prospects/schemas/prospect.schemas'
import {
  PROSPECT_STATUSES,
  type Prospect,
} from '@/features/prospects/types/prospect.types'
import type { Company } from '@/features/companies/types/company.types'
import { useLeads } from '@/features/leads/hooks/use-leads'
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

type ProspectFormValues = CreateProspectFormValues | UpdateProspectFormValues

type ProspectFormProps = {
  mode: 'create' | 'edit'
  initial?: Prospect | null
  companies: Company[]
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: ProspectFormValues) => Promise<void> | void
  onCancel?: () => void
}

function emptyValues(): CreateProspectFormValues {
  return {
    companyId: '',
    leadId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    status: 'new',
    notes: '',
  }
}

function fromProspect(prospect: Prospect): CreateProspectFormValues {
  return {
    companyId: prospect.companyId,
    leadId: prospect.leadId,
    firstName: prospect.firstName,
    lastName: prospect.lastName ?? '',
    email: prospect.email ?? '',
    phone: prospect.phone ?? '',
    jobTitle: prospect.jobTitle ?? '',
    status: (PROSPECT_STATUSES as readonly string[]).includes(prospect.status)
      ? (prospect.status as CreateProspectFormValues['status'])
      : 'new',
    notes: prospect.notes ?? '',
  }
}

function leadLabel(firstName: string, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(' ')
}

export function ProspectForm({
  mode,
  initial,
  companies,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: ProspectFormProps) {
  const schema = mode === 'create' ? createProspectSchema : updateProspectSchema

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProspectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromProspect(initial) : emptyValues(),
  })

  const selectedCompanyId = watch('companyId') || ''
  const leadsQuery = useLeads(
    selectedCompanyId ? { companyId: selectedCompanyId } : undefined,
  )
  const companyLeads = (leadsQuery.data ?? []).filter(
    (lead) => lead.companyId === selectedCompanyId,
  )
  const companySelected = Boolean(selectedCompanyId)
  const noLeadsForCompany =
    companySelected &&
    !leadsQuery.isLoading &&
    !leadsQuery.isError &&
    companyLeads.length === 0

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        await onSubmit({
          companyId: formValues.companyId?.trim() ?? '',
          leadId: formValues.leadId?.trim() ?? '',
          firstName: formValues.firstName?.trim() ?? '',
          lastName: formValues.lastName?.trim() ?? '',
          email: formValues.email?.trim() ?? '',
          phone: formValues.phone?.trim() ?? '',
          jobTitle: formValues.jobTitle?.trim() ?? '',
          status: formValues.status,
          notes: formValues.notes?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="prospect-company">Company</Label>
        <Controller
          name="companyId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={(value) => {
                field.onChange(value)
                setValue('leadId', '', { shouldDirty: true, shouldValidate: true })
              }}
              disabled={submitting || companies.length === 0}
            >
              <SelectTrigger id="prospect-company" className="w-full">
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

      <div className="space-y-2">
        <Label htmlFor="prospect-lead">Lead</Label>
        <Controller
          name="leadId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
              disabled={
                submitting || !companySelected || companyLeads.length === 0
              }
            >
              <SelectTrigger id="prospect-lead" className="w-full">
                <SelectValue
                  placeholder={
                    !companySelected
                      ? 'Select a company first'
                      : leadsQuery.isLoading
                        ? 'Loading leads…'
                        : 'Select a lead'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {companyLeads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {leadLabel(lead.firstName, lead.lastName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.leadId && (
          <p className="text-sm text-destructive">{errors.leadId.message}</p>
        )}
        {noLeadsForCompany && (
          <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-3 text-sm">
            <p className="font-medium">No leads available for this company</p>
            <p className="mt-1 text-muted-foreground">
              Create a lead for this company before adding a prospect.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
              <Link to="/leads">
                <Users className="size-4" />
                Go to Leads
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="prospect-first-name">First name</Label>
          <Input
            id="prospect-first-name"
            autoComplete="given-name"
            disabled={submitting}
            {...register('firstName')}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prospect-last-name">Last name</Label>
          <Input
            id="prospect-last-name"
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
        <Label htmlFor="prospect-email">Email</Label>
        <Input
          id="prospect-email"
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
        <Label htmlFor="prospect-phone">Phone</Label>
        <Input
          id="prospect-phone"
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
        <Label htmlFor="prospect-job-title">Job title</Label>
        <Input
          id="prospect-job-title"
          disabled={submitting}
          {...register('jobTitle')}
        />
        {errors.jobTitle && (
          <p className="text-sm text-destructive">{errors.jobTitle.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="prospect-status">Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || 'new'}
              onValueChange={field.onChange}
              disabled={submitting}
            >
              <SelectTrigger id="prospect-status" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {PROSPECT_STATUSES.map((item) => (
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

      <div className="space-y-2">
        <Label htmlFor="prospect-notes">Notes</Label>
        <Input
          id="prospect-notes"
          disabled={submitting}
          {...register('notes')}
        />
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
          disabled={
            submitting ||
            noLeadsForCompany ||
            (mode === 'edit' && !isDirty)
          }
        >
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
