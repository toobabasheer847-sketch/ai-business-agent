import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { UserDeleteDialog } from '@/features/users/components/user-delete-dialog'
import { UserForm } from '@/features/users/components/user-form'
import { UsersFilters } from '@/features/users/components/users-filters'
import { UsersTable } from '@/features/users/components/users-table'
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from '@/features/users/hooks/use-users'
import type {
  CreateUserFormValues,
  UpdateUserFormValues,
} from '@/features/users/schemas/user.schemas'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  UserListQuery,
} from '@/features/users/types/user.types'

function TableSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-5/6" />
    </div>
  )
}

function toCreatePayload(values: CreateUserFormValues): CreateUserRequest {
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    isActive: values.isActive ?? true,
  }
}

function toUpdatePayload(values: UpdateUserFormValues): UpdateUserRequest {
  const payload: UpdateUserRequest = {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    isActive: values.isActive,
  }

  if (values.password?.trim()) {
    payload.password = values.password
  }

  return payload
}

function userErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (!(error instanceof ApiError)) return message

  if (error.status === 409) {
    return message || 'Email already registered.'
  }

  if (error.status === 400 && /cannot delete your own/i.test(message)) {
    return message
  }

  if (error.status === 404 && /user not found/i.test(message)) {
    return message
  }

  return message
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const listQueryInput = useMemo<UserListQuery | undefined>(() => {
    const query: UserListQuery = {
      search: debouncedSearch.trim() || undefined,
      isActive:
        isActive === '' ? undefined : isActive === 'true',
    }
    if (query.search === undefined && query.isActive === undefined) {
      return undefined
    }
    return query
  }, [debouncedSearch, isActive])

  const listQuery = useUsers(listQueryInput)
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()

  const items = listQuery.data ?? []
  const hasFilters = Boolean(search || isActive)

  async function handleCreate(
    values: CreateUserFormValues | UpdateUserFormValues,
  ) {
    try {
      await createMutation.mutateAsync(
        toCreatePayload(values as CreateUserFormValues),
      )
      toast.success('User created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(userErrorMessage(error))
    }
  }

  async function handleUpdate(
    values: CreateUserFormValues | UpdateUserFormValues,
  ) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values as UpdateUserFormValues),
      })
      toast.success('User updated')
      setEditing(null)
    } catch (error) {
      toast.error(userErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    if (currentUser?.id && deleting.id === currentUser.id) {
      toast.error('You cannot delete your own user account.')
      setDeleting(null)
      return
    }
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'User deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(userErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage users for this tenant. Tenant scope comes from your JWT session. Passwords are never returned."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw
                className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add user
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <UsersFilters
          search={search}
          isActive={isActive}
          onSearchChange={setSearch}
          onIsActiveChange={setIsActive}
          onReset={() => {
            setSearch('')
            setIsActive('')
            setDebouncedSearch('')
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(listQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void listQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">
            {hasFilters ? 'No matching users' : 'No users yet'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? 'No users match your search or filters. Try adjusting them.'
              : 'Create a user for this tenant. The account is scoped from your JWT.'}
          </p>
          {!hasFilters && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Add user
            </Button>
          )}
        </motion.div>
      ) : (
        <UsersTable
          items={items}
          currentUserId={currentUser?.id}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped user via <code>POST /api/users</code>.
              Password is hashed server-side and never returned.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            mode="create"
            submitLabel="Create"
            submitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/users/:id</code>. Leave password
              blank to keep the current password.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <UserForm
              key={editing.id}
              mode="edit"
              initial={editing}
              submitLabel="Save changes"
              submitting={updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      <UserDeleteDialog
        user={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
