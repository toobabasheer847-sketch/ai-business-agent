const LABELS: Record<string, string> = {
  task: 'Task',
  sales: 'Sales',
  proposal: 'Proposal',
  communication: 'Communication',
  ai_automation: 'AI',
  approval: 'Approval',
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function exceptionLabel(value: string) {
  return LABELS[value] ?? value
}

export function severityClass(severity: string) {
  if (severity === 'critical') return 'bg-destructive/15 text-destructive'
  if (severity === 'high') return 'bg-chart-5/20 text-foreground'
  if (severity === 'medium') return 'bg-chart-4/20 text-foreground'
  return 'bg-muted text-muted-foreground'
}

export function relatedHref(sourceType: string) {
  if (sourceType === 'task' || sourceType === 'task_reminder') return '/tasks'
  if (sourceType === 'lead') return '/leads'
  if (sourceType === 'prospect') return '/prospects'
  if (sourceType === 'proposal') return '/proposals'
  if (sourceType === 'ai_approval') return '/approvals'
  if (sourceType === 'agent' || sourceType === 'agent_run') return '/ai-monitoring'
  return null
}

export function canManageException(status: string) {
  return status === 'open' || status === 'acknowledged' || status === 'in_progress'
}

export function availableActions(status: string) {
  return {
    acknowledge: status === 'open' || status === 'in_progress',
    progress: status === 'open' || status === 'acknowledged',
    resolve: canManageException(status),
    dismiss: canManageException(status),
    assign: canManageException(status),
  }
}
