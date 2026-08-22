export type TaskListHrefInput = {
  status?: string;
  priority?: string;
  overdue?: boolean;
  companyId?: string;
  prospectId?: string;
  leadId?: string;
  assigneeId?: string;
  hasReminder?: boolean;
};

export function buildTasksListHref(input: TaskListHrefInput = {}): string {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.priority) params.set('priority', input.priority);
  if (input.overdue) params.set('overdue', 'true');
  if (input.companyId) params.set('companyId', input.companyId);
  if (input.prospectId) params.set('prospectId', input.prospectId);
  if (input.leadId) params.set('leadId', input.leadId);
  if (input.assigneeId) params.set('assigneeId', input.assigneeId);
  if (input.hasReminder) params.set('hasReminder', 'true');
  const query = params.toString();
  return query ? `/tasks?${query}` : '/tasks';
}
