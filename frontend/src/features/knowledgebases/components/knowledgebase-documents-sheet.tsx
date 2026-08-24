import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { KnowledgeDocumentsPanel } from '@/features/knowledgebases/components/knowledge-documents-panel'
import type { Knowledgebase } from '@/features/knowledgebases/types/knowledgebase.types'

type KnowledgebaseDocumentsSheetProps = {
  knowledgebase: Knowledgebase | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KnowledgebaseDocumentsSheet({
  knowledgebase,
  open,
  onOpenChange,
}: KnowledgebaseDocumentsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>Documents</SheetTitle>
          <SheetDescription>
            {knowledgebase
              ? `Upload and index files for ${knowledgebase.name}.`
              : 'Upload and index knowledge documents.'}
          </SheetDescription>
        </SheetHeader>
        {knowledgebase && (
          <KnowledgeDocumentsPanel knowledgeBaseId={knowledgebase.id} />
        )}
      </SheetContent>
    </Sheet>
  )
}
