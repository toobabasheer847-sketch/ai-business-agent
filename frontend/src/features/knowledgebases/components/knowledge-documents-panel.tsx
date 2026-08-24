import { useRef, useState } from 'react'
import {
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api'
import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
  useRetryKnowledgeDocument,
  useUploadKnowledgeDocument,
} from '@/features/knowledgebases/hooks/use-knowledge-documents'
import type { KnowledgeDocumentStatus } from '@/features/knowledgebases/types/knowledge-document.types'

const ACCEPTED_TYPES = '.pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

type KnowledgeDocumentsPanelProps = {
  knowledgeBaseId: string
}

function statusLabel(status: KnowledgeDocumentStatus) {
  if (status === 'pending') return 'Waiting'
  if (status === 'processing') return 'Processing'
  if (status === 'indexed') return 'Indexed'
  return 'Failed'
}

function statusVariant(status: KnowledgeDocumentStatus) {
  if (status === 'indexed') return 'default' as const
  if (status === 'failed') return 'destructive' as const
  if (status === 'processing') return 'outline' as const
  return 'secondary' as const
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatBytes(value: number | null) {
  if (!value) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeDocumentsPanel({
  knowledgeBaseId,
}: KnowledgeDocumentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const listQuery = useKnowledgeDocuments(knowledgeBaseId)
  const uploadMutation = useUploadKnowledgeDocument(knowledgeBaseId)
  const retryMutation = useRetryKnowledgeDocument(knowledgeBaseId)
  const deleteMutation = useDeleteKnowledgeDocument(knowledgeBaseId)

  const documents = listQuery.data ?? []

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    try {
      await uploadMutation.mutateAsync(file)
      toast.success('Document uploaded')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleRetry(documentId: string) {
    try {
      await retryMutation.mutateAsync(documentId)
      toast.success('Document queued for retry')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId)
    try {
      const result = await deleteMutation.mutateAsync(documentId)
      toast.success(result.message || 'Document deleted')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          PDF, TXT, and DOCX files up to 10MB.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw
              className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploadMutation.isPending ? 'Uploading…' : 'Upload document'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files)
            }}
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
        </div>
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load documents</AlertTitle>
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
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium">No documents yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Upload a company document to index it for the AI Assistant.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="font-medium">{document.originalFilename}</div>
                    {document.status === 'failed' && document.failureReason && (
                      <p className="mt-1 text-xs text-destructive">
                        {document.failureReason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(document.status)}>
                      {document.status === 'processing' && (
                        <Loader2 className="size-3 animate-spin" />
                      )}
                      {statusLabel(document.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatBytes(document.byteSize)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDate(document.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {document.status === 'failed' && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={retryMutation.isPending}
                          onClick={() => void handleRetry(document.id)}
                          aria-label={`Retry ${document.originalFilename}`}
                        >
                          <RefreshCw className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={deletingId === document.id}
                        onClick={() => void handleDelete(document.id)}
                        aria-label={`Delete ${document.originalFilename}`}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
