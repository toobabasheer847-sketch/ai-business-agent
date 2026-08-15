import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api'
import { BrandForm } from '@/features/brands/components/brand-form'
import { BrandPreview } from '@/features/brands/components/brand-preview'
import {
  useBrands,
  useCreateBrand,
  useDeleteBrand,
  useUpdateBrand,
} from '@/features/brands/hooks/use-brands'
import type {
  CreateBrandFormValues,
  UpdateBrandFormValues,
} from '@/features/brands/schemas/brand.schemas'
import type {
  CreateBrandRequest,
  UpdateBrandRequest,
} from '@/features/brands/types/brand.types'

function BrandsPageSkeleton() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-28 ml-auto" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  )
}

function toCreatePayload(values: CreateBrandFormValues): CreateBrandRequest {
  return {
    name: values.name.trim(),
    logoUrl: values.logoUrl?.trim() || undefined,
    domain: values.domain?.trim() || undefined,
    apiUrl: values.apiUrl?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
  }
}

function toUpdatePayload(values: UpdateBrandFormValues): UpdateBrandRequest {
  return {
    name: values.name.trim(),
    logoUrl: values.logoUrl?.trim() || undefined,
    domain: values.domain?.trim() || undefined,
    apiUrl: values.apiUrl?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
  }
}

export function BrandsPage() {
  const brandsQuery = useBrands()
  const createMutation = useCreateBrand()
  const updateMutation = useUpdateBrand()
  const deleteMutation = useDeleteBrand()

  const [creating, setCreating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [preview, setPreview] = useState<{
    name?: string
    logoUrl?: string | null
    domain?: string | null
    phone?: string | null
  }>({})

  const brand = brandsQuery.data?.[0] ?? null

  const handlePreviewChange = useCallback(
    (values: CreateBrandFormValues | UpdateBrandFormValues) => {
      setPreview({
        name: values.name,
        logoUrl: values.logoUrl,
        domain: values.domain,
        phone: values.phone,
      })
    },
    [],
  )

  async function handleCreate(values: CreateBrandFormValues) {
    try {
      await createMutation.mutateAsync(toCreatePayload(values))
      toast.success('Brand created')
      setCreating(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          getErrorMessage(error) ||
            'A brand already exists for this tenant. Reloading…',
        )
        await brandsQuery.refetch()
        setCreating(false)
        return
      }
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUpdate(values: UpdateBrandFormValues) {
    if (!brand) return
    try {
      await updateMutation.mutateAsync({
        id: brand.id,
        payload: toUpdatePayload(values),
      })
      toast.success('Brand updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!brand) return
    try {
      const result = await deleteMutation.mutateAsync(brand.id)
      toast.success(result.message || 'Brand deleted')
      setDeleteOpen(false)
      setCreating(false)
      setPreview({})
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Brand"
        description="Brand identity for this tenant. One brand per tenant. Logo is a URL only — no file upload."
      />

      {brandsQuery.isLoading ? (
        <BrandsPageSkeleton />
      ) : brandsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load brand</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(brandsQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void brandsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !brand && !creating ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No brand yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your brand identity for this tenant. You can set a logo URL,
            domain, API URL, and phone.
          </p>
          <Button type="button" className="mt-4" onClick={() => setCreating(true)}>
            Create Brand
          </Button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>
                {brand ? 'Brand information' : 'Create brand'}
              </CardTitle>
              <CardDescription>
                {brand
                  ? 'Update the fields supported by the Brand API.'
                  : 'Creates a tenant-scoped brand via POST /api/brands.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {brand ? (
                <BrandForm
                  key={`${brand.id}-${brand.updatedAt}`}
                  mode="edit"
                  initial={brand}
                  submitting={updateMutation.isPending}
                  submitLabel="Save changes"
                  onValuesChange={handlePreviewChange}
                  onSubmit={handleUpdate}
                  secondaryAction={
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={updateMutation.isPending || deleteMutation.isPending}
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete brand
                    </Button>
                  }
                />
              ) : (
                <BrandForm
                  mode="create"
                  submitting={createMutation.isPending}
                  submitLabel="Create Brand"
                  onValuesChange={handlePreviewChange}
                  onCancel={() => {
                    setCreating(false)
                    setPreview({})
                  }}
                  onSubmit={handleCreate}
                />
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Live preview of name, logo URL, domain, and phone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandPreview
                name={preview.name ?? brand?.name}
                logoUrl={preview.logoUrl ?? brand?.logoUrl}
                domain={preview.domain ?? brand?.domain}
                phone={preview.phone ?? brand?.phone}
              />
              {brand ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Brand ID: <span className="break-all">{brand.id}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete brand</DialogTitle>
            <DialogDescription>
              This removes <strong>{brand?.name}</strong> for the current tenant.
              You can create a new brand afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}