import { FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { AssistantSource } from '@/features/assistant/types/assistant.types'

type AssistantSourcesListProps = {
  sources: AssistantSource[]
  usedKnowledge?: boolean
  message?: string
}

export function AssistantSourcesList({
  sources,
  usedKnowledge,
  message,
}: AssistantSourcesListProps) {
  if (usedKnowledge === false) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        {message ??
          'No matching knowledge base sources were found for this answer.'}
      </p>
    )
  }

  if (!sources.length) {
    return null
  }

  return (
    <div className="space-y-1.5 px-1">
      <p className="text-xs font-medium text-muted-foreground">Sources</p>
      <ul className="space-y-1">
        {sources.map((source) => (
          <li
            key={source.chunkId}
            className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1.5 text-xs"
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {source.documentName ?? source.source ?? 'Knowledge chunk'}
            </span>
            {source.sourceType && (
              <Badge variant="outline" className="h-5 text-[10px]">
                {source.sourceType}
              </Badge>
            )}
            {source.chunkIndex !== undefined && source.chunkIndex !== null && (
              <span className="text-muted-foreground">
                chunk {String(source.chunkIndex)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
