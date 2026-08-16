import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createKnowledgebaseSchema,
  updateKnowledgebaseSchema,
  type CreateKnowledgebaseFormValues,
  type UpdateKnowledgebaseFormValues,
} from '@/features/knowledgebases/schemas/knowledgebase.schemas'
import type { Knowledgebase } from '@/features/knowledgebases/types/knowledgebase.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type KnowledgebaseFormValues =
  | CreateKnowledgebaseFormValues
  | UpdateKnowledgebaseFormValues

type KnowledgebaseFormProps = {
  mode: 'create' | 'edit'
  initial?: Knowledgebase | null
  submitting?: boolean
  submitLabel: string
  onSubmit: (values: KnowledgebaseFormValues) => Promise<void> | void
  onCancel?: () => void
}

function emptyValues(): CreateKnowledgebaseFormValues {
  return {
    name: '',
    description: '',
  }
}

function fromKnowledgebase(
  kb: Knowledgebase,
): CreateKnowledgebaseFormValues {
  return {
    name: kb.name,
    description: kb.description ?? '',
  }
}

export function KnowledgebaseForm({
  mode,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: KnowledgebaseFormProps) {
  const schema =
    mode === 'create' ? createKnowledgebaseSchema : updateKnowledgebaseSchema

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<KnowledgebaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromKnowledgebase(initial) : emptyValues(),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          name: values.name?.trim() ?? '',
          description: values.description?.trim() ?? '',
        })
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="kb-name">Name</Label>
        <Input
          id="kb-name"
          placeholder="e.g. Product FAQ"
          disabled={submitting}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="kb-description">
          Description{' '}
          <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="kb-description"
          placeholder="Short description of this knowledge base"
          disabled={submitting}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
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
