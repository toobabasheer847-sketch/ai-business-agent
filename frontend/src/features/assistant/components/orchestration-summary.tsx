import { Button } from '@/components/ui/button'
import type { AssistantOrchestration } from '@/features/assistant/types/assistant.types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
  awaiting_confirmation: 'Awaiting confirmation',
}

type OrchestrationSummaryProps = {
  orchestration: AssistantOrchestration
  confirming?: boolean
  onConfirm?: (orchestrationId: string) => void
}

export function OrchestrationSummary({
  orchestration,
  confirming = false,
  onConfirm,
}: OrchestrationSummaryProps) {
  const needsConfirmation = orchestration.operations.some(
    (operation) => operation.status === 'awaiting_confirmation',
  )

  return (
    <div className="space-y-2 rounded-xl border bg-background px-3 py-2 text-foreground" data-testid="orchestration-summary">
      <p className="text-xs font-medium text-muted-foreground">
        Execution summary
        <span className="sr-only">. Status {orchestration.status.replaceAll('_', ' ')}</span>
      </p>
      {orchestration.clarification ? (
        <p className="text-sm">{orchestration.clarification}</p>
      ) : null}
      <ul className="space-y-1">
        {orchestration.operations.map((operation) => (
          <li key={operation.operationId} className="flex items-start justify-between gap-3 text-sm">
            <span>
              <span className="font-medium">{operation.action}</span>
              {operation.summary ? <span className="mt-0.5 block text-muted-foreground">{operation.summary}</span> : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {STATUS_LABELS[operation.status] ?? operation.status}
            </span>
          </li>
        ))}
      </ul>
      {needsConfirmation && onConfirm ? (
        <Button
          type="button"
          size="sm"
          disabled={confirming}
          onClick={() => onConfirm(orchestration.id)}
        >
          {confirming ? 'Confirming…' : 'Confirm'}
        </Button>
      ) : null}
    </div>
  )
}
