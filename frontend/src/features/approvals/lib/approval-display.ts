export function approvalStatusLabel(status: string) {
  if (status === 'pending') return 'Pending'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  if (status === 'executing') return 'Executing'
  if (status === 'executed') return 'Executed'
  if (status === 'failed') return 'Failed'
  if (status === 'expired') return 'Expired'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

export function editableFields(actionType: string) {
  if (actionType === 'email.send') return ['subject', 'body']
  if (actionType === 'sms.send') return ['body']
  return []
}

export function needsHighRiskConfirmation(riskLevel: string) {
  return riskLevel === 'high'
}

export function approvalStatusClass(status: string) {
  if (status === 'pending') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
  if (status === 'approved') return 'bg-primary/10 text-primary'
  if (status === 'executing') return 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
  if (status === 'executed') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === 'rejected') return 'bg-orange-500/15 text-orange-800 dark:text-orange-200'
  if (status === 'failed') return 'bg-destructive/10 text-destructive'
  if (status === 'expired') return 'bg-muted text-muted-foreground'
  if (status === 'cancelled') return 'bg-slate-500/15 text-slate-700 dark:text-slate-200'
  return 'bg-muted text-muted-foreground'
}
