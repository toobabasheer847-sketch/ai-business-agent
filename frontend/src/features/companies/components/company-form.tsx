import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyFormValues,
  type UpdateCompanyFormValues,
} from '@/features/companies/schemas/company.schemas'
import type { Company } from '@/features/companies/types/company.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CompanyFormValues = CreateCompanyFormValues | UpdateCompanyFormValues

type CompanyFormProps = {
  mode: 'create' | 'edit'
  initial?: Company | null
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: CompanyFormValues) => Promise<void> | void
  onCancel?: () => void
}

function emptyValues(): CreateCompanyFormValues {
  return {
    name: '',
    domain: '',
    website: '',
    industry: '',
    description: '',
  }
}

function fromCompany(company: Company): CreateCompanyFormValues {
  return {
    name: company.name,
    domain: company.domain ?? '',
    website: company.website ?? '',
    industry: company.industry ?? '',
    description: company.description ?? '',
  }
}

export function CompanyForm({
  mode,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: CompanyFormProps) {
  const schema = mode === 'create' ? createCompanySchema : updateCompanySchema

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromCompany(initial) : emptyValues(),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (formValues) => {
        await onSubmit({
          name: formValues.name?.trim() ?? '',
          domain: formValues.domain?.trim() ?? '',
          website: formValues.website?.trim() ?? '',
          industry: formValues.industry?.trim() ?? '',
          description: formValues.description?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="company-name">Name</Label>
        <Input
          id="company-name"
          autoComplete="organization"
          disabled={submitting}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-domain">Domain</Label>
        <Input
          id="company-domain"
          placeholder="example.com"
          disabled={submitting}
          {...register('domain')}
        />
        {errors.domain && (
          <p className="text-sm text-destructive">{errors.domain.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-website">Website</Label>
        <Input
          id="company-website"
          type="url"
          placeholder="https://example.com"
          disabled={submitting}
          {...register('website')}
        />
        {errors.website && (
          <p className="text-sm text-destructive">{errors.website.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-industry">Industry</Label>
        <Input
          id="company-industry"
          placeholder="Technology"
          disabled={submitting}
          {...register('industry')}
        />
        {errors.industry && (
          <p className="text-sm text-destructive">{errors.industry.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-description">Description</Label>
        <Input
          id="company-description"
          placeholder="Short description"
          disabled={submitting}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
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
