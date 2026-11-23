import { scoreException } from './exception-priority';
import {
  DEFAULT_DETECTION_CONFIG,
  type ApprovalEvidence,
  type DetectionConfig,
  type DetectionSnapshot,
  type ExceptionDraft,
  type ExceptionSeverity,
  type LeadEvidence,
  type ProposalEvidence,
  type ProspectEvidence,
  type ReminderEvidence,
  type RunEvidence,
  type TaskEvidence,
} from './exception.types';

const DAY = 24 * 60 * 60 * 1000;
const SECRET_TEST = /token|password|secret|apikey|api_key|bearer\s+\S+/i;
const SECRET = /token|password|secret|apikey|api_key|bearer\s+\S+/gi;

export function detectExceptions(
  snapshot: DetectionSnapshot,
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG,
): ExceptionDraft[] {
  const drafts: ExceptionDraft[] = [];
  for (const task of snapshot.tasks) {
    const draft = taskDraft(task, snapshot.now, config);
    if (draft) drafts.push(draft);
  }
  for (const lead of snapshot.leads)
    drafts.push(...leadDrafts(lead, snapshot.now, config));
  for (const prospect of snapshot.prospects) {
    const draft = prospectDraft(prospect, snapshot.now, config);
    if (draft) drafts.push(draft);
  }
  for (const proposal of snapshot.proposals) {
    const draft = proposalDraft(proposal, snapshot.now, config);
    if (draft) drafts.push(draft);
  }
  for (const reminder of snapshot.reminders) {
    const draft = reminderDraft(reminder);
    if (draft) drafts.push(draft);
  }
  drafts.push(...runDrafts(snapshot.runs, snapshot.now, config));
  for (const approval of snapshot.approvals) {
    const draft = approvalDraft(approval, snapshot.now, config);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

export function priorityFor(
  draft: ExceptionDraft,
  occurrenceCount: number,
  acknowledged: boolean,
) {
  const days = Number(draft.metadata.daysOverdue ?? 0);
  return scoreException({
    severity: draft.severity,
    daysOverdue: Number.isFinite(days) ? days : 0,
    occurrenceCount,
    acknowledged,
  });
}

function taskDraft(
  task: TaskEvidence,
  now: Date,
  config: DetectionConfig,
): ExceptionDraft | null {
  const open = task.status === 'pending' || task.status === 'in_progress';
  if (!open) return null;
  if (task.assignedTo && task.assigneeActive === false) {
    return taskException(
      task,
      'high',
      'inactive-assignee',
      'This task is still open and assigned to an inactive user.',
      'Reassign the task to an active team member.',
      0,
    );
  }
  if (task.dueAt && task.dueAt.getTime() < now.getTime()) {
    const days = Math.max(
      1,
      Math.floor((now.getTime() - task.dueAt.getTime()) / DAY),
    );
    const severity: ExceptionSeverity =
      days >= 4 || task.priority === 'urgent' ? 'critical' : 'high';
    return taskException(
      task,
      severity,
      'overdue',
      `This task is overdue by ${days} day${days === 1 ? '' : 's'} and is still ${task.status.replace('_', ' ')}.`,
      'Review the task and update the due date or complete it.',
      days,
    );
  }
  if (
    task.dueAt &&
    task.dueAt.getTime() - now.getTime() <= config.dueSoonHours * 60 * 60 * 1000
  ) {
    return taskException(
      task,
      'medium',
      'due-soon',
      'This task is due within the next day and is not complete.',
      'Confirm the owner can finish it before the due time.',
      0,
    );
  }
  const ageDays = Math.floor((now.getTime() - task.createdAt.getTime()) / DAY);
  if (
    (task.priority === 'high' || task.priority === 'urgent') &&
    ageDays >= config.highPriorityOpenDays
  ) {
    return taskException(
      task,
      task.priority === 'urgent' ? 'high' : 'medium',
      'high-priority-open',
      `This ${task.priority} task has stayed ${task.status.replace('_', ' ')} for ${ageDays} days.`,
      'Check why the high-priority task has not moved.',
      0,
    );
  }
  if (!task.dueAt && ageDays >= config.staleOpenDays) {
    return taskException(
      task,
      'low',
      'open-too-long',
      `This task has stayed open for ${ageDays} days since it was created.`,
      'Close the task or give it a due date.',
      0,
    );
  }
  return null;
}

function taskException(
  task: TaskEvidence,
  severity: ExceptionSeverity,
  rule: string,
  description: string,
  action: string,
  daysOverdue: number,
): ExceptionDraft {
  return draft({
    exceptionKey: `task:${task.id}`,
    category: 'task',
    severity,
    title: `Task needs attention: ${clip(task.title, 120)}`,
    description,
    sourceType: 'task',
    sourceId: task.id,
    recommendedAction: action,
    recommendedActionType: 'review_task',
    metadata: {
      rule,
      daysOverdue,
      priority: task.priority,
      status: task.status,
      companyId: task.companyId,
    },
  });
}

function leadDrafts(
  lead: LeadEvidence,
  now: Date,
  config: DetectionConfig,
): ExceptionDraft[] {
  const found: ExceptionDraft[] = [];
  const email = lead.email?.trim();
  const phone = lead.phone?.trim();
  if (!email && !phone) {
    found.push(
      draft({
        exceptionKey: `lead:${lead.id}:contact`,
        category: 'sales',
        severity: 'medium',
        title: `Lead is missing contact details: ${clip(lead.name, 80)}`,
        description:
          'This lead has neither an email address nor a phone number, so follow-up cannot be sent.',
        sourceType: 'lead',
        sourceId: lead.id,
        recommendedAction:
          'Add an email address or phone number before the next follow-up.',
        recommendedActionType: 'review_lead',
        metadata: {
          rule: 'missing-contact',
          companyId: lead.companyId,
          daysOverdue: 0,
        },
      }),
    );
  }
  const ageDays = Math.floor((now.getTime() - lead.createdAt.getTime()) / DAY);
  if (lead.status === 'new' && ageDays >= config.leadUncontactedDays) {
    found.push(
      draft({
        exceptionKey: `lead:${lead.id}:uncontacted`,
        category: 'sales',
        severity: 'high',
        title: `Lead has not been contacted: ${clip(lead.name, 80)}`,
        description: `This lead is still new ${ageDays} days after it was created. No follow-up log exists, so this uses creation time and status only.`,
        sourceType: 'lead',
        sourceId: lead.id,
        recommendedAction:
          'Contact the lead or update the status if work already happened.',
        recommendedActionType: 'review_lead',
        metadata: {
          rule: 'uncontacted',
          companyId: lead.companyId,
          daysOverdue: ageDays,
        },
      }),
    );
  }
  return found;
}

function prospectDraft(
  prospect: ProspectEvidence,
  now: Date,
  config: DetectionConfig,
): ExceptionDraft | null {
  if (prospect.status !== 'new' && prospect.status !== 'contacted') return null;
  const ageDays = Math.floor(
    (now.getTime() - prospect.updatedAt.getTime()) / DAY,
  );
  if (ageDays < config.prospectStaleDays) return null;
  return draft({
    exceptionKey: `prospect:${prospect.id}:stale`,
    category: 'sales',
    severity: 'medium',
    title: `Prospect has no recent update: ${clip(prospect.name, 80)}`,
    description: `This prospect is still ${prospect.status} and its record has not been updated for ${ageDays} days.`,
    sourceType: 'prospect',
    sourceId: prospect.id,
    recommendedAction: 'Review the prospect and record the next step.',
    recommendedActionType: 'review_prospect',
    metadata: {
      rule: 'stale',
      companyId: prospect.companyId,
      daysOverdue: ageDays,
    },
  });
}

function proposalDraft(
  proposal: ProposalEvidence,
  now: Date,
  config: DetectionConfig,
): ExceptionDraft | null {
  const expired =
    proposal.status === 'expired' ||
    (proposal.validUntil != null &&
      proposal.validUntil.getTime() < now.getTime() &&
      (proposal.status === 'sent' || proposal.status === 'viewed'));
  if (expired) {
    const days =
      proposal.validUntil && proposal.validUntil.getTime() < now.getTime()
        ? Math.max(
            1,
            Math.floor((now.getTime() - proposal.validUntil.getTime()) / DAY),
          )
        : 0;
    return proposalException(
      proposal,
      'critical',
      'expired',
      'This proposal reached its validity deadline without an acceptance or rejection.',
      'Decide whether to renew the proposal or close it.',
      days,
    );
  }
  if (
    proposal.validUntil &&
    (proposal.status === 'sent' || proposal.status === 'viewed')
  ) {
    const daysLeft = Math.ceil(
      (proposal.validUntil.getTime() - now.getTime()) / DAY,
    );
    if (daysLeft <= config.proposalExpiringDays) {
      return proposalException(
        proposal,
        'high',
        'expiring',
        `This proposal expires in ${Math.max(daysLeft, 0)} day${daysLeft === 1 ? '' : 's'} and has no final decision.`,
        'Follow up before the validity date.',
        0,
      );
    }
  }
  if (proposal.status === 'sent' && !proposal.viewedAt && proposal.sentAt) {
    const days = Math.floor((now.getTime() - proposal.sentAt.getTime()) / DAY);
    if (days >= config.proposalNotViewedDays) {
      return proposalException(
        proposal,
        'high',
        'not-viewed',
        `This proposal was sent ${days} days ago and has no viewed timestamp.`,
        'Check whether the recipient opened it.',
        days,
      );
    }
  }
  if (proposal.status === 'viewed' && proposal.viewedAt) {
    const days = Math.floor(
      (now.getTime() - proposal.viewedAt.getTime()) / DAY,
    );
    if (days >= config.proposalNoDecisionDays) {
      return proposalException(
        proposal,
        'medium',
        'no-decision',
        `This proposal was viewed ${days} days ago and is still not accepted or rejected.`,
        'Ask for a decision or update the proposal.',
        days,
      );
    }
  }
  return null;
}

function proposalException(
  proposal: ProposalEvidence,
  severity: ExceptionSeverity,
  rule: string,
  description: string,
  action: string,
  daysOverdue: number,
): ExceptionDraft {
  return draft({
    exceptionKey: `proposal:${proposal.id}`,
    category: 'proposal',
    severity,
    title: `Proposal needs a decision: ${clip(proposal.title, 100)}`,
    description,
    sourceType: 'proposal',
    sourceId: proposal.id,
    recommendedAction: action,
    recommendedActionType: 'review_proposal',
    metadata: { rule, status: proposal.status, daysOverdue },
  });
}

function reminderDraft(reminder: ReminderEvidence): ExceptionDraft | null {
  if (reminder.status !== 'failed') return null;
  return draft({
    exceptionKey: `reminder:${reminder.id}`,
    category: 'communication',
    severity: reminder.attemptCount >= 2 ? 'high' : 'medium',
    title: 'A task reminder delivery failed',
    description: `A ${reminder.channel ?? 'reminder'} delivery failed after ${reminder.attemptCount} attempt${reminder.attemptCount === 1 ? '' : 's'}. Detection does not send another message.`,
    sourceType: 'task_reminder',
    sourceId: reminder.id,
    recommendedAction:
      'Review the reminder failure and retry only from the task screen if that action is still appropriate.',
    recommendedActionType: 'review_delivery',
    metadata: {
      rule: 'delivery-failed',
      taskId: reminder.taskId,
      attemptCount: reminder.attemptCount,
      daysOverdue: 0,
    },
  });
}

function runDrafts(
  runs: RunEvidence[],
  now: Date,
  config: DetectionConfig,
): ExceptionDraft[] {
  const cutoff = now.getTime() - config.lookbackDays * DAY;
  const recent = runs.filter((run) => run.startedAt.getTime() >= cutoff);
  const failed = recent.filter((run) => run.status === 'failed');
  const byAgent = new Map<string, RunEvidence[]>();
  for (const run of failed) {
    const list = byAgent.get(run.agentName) ?? [];
    list.push(run);
    byAgent.set(run.agentName, list);
  }
  const drafts: ExceptionDraft[] = [];
  const covered = new Set<string>();
  for (const [agentName, items] of byAgent) {
    if (items.length >= config.repeatedFailureCount) {
      drafts.push(
        draft({
          exceptionKey: `agent:${agentName}:failures`,
          category: 'ai_automation',
          severity: 'high',
          title: `${agentName} failed ${items.length} times`,
          description: `${items.length} ${agentName} runs failed in the last ${config.lookbackDays} days.`,
          sourceType: 'agent',
          sourceId: agentName.slice(0, 80),
          recommendedAction:
            'Open AI monitoring and inspect the failed runs before retrying the workflow.',
          recommendedActionType: 'review_run',
          metadata: {
            rule: 'repeated-failures',
            count: items.length,
            daysOverdue: 0,
          },
        }),
      );
      for (const item of items) covered.add(item.id);
    }
  }
  for (const run of recent) {
    if (run.status === 'failed') {
      if (!covered.has(run.id)) {
        drafts.push(
          runException(
            run,
            'medium',
            'failed',
            `${run.agentName} run failed.`,
            'Inspect the run error in AI monitoring.',
          ),
        );
      }
      continue;
    }
    if (run.durationMs != null && run.durationMs >= config.slowRunMs) {
      drafts.push(
        runException(
          run,
          'low',
          'slow',
          `${run.agentName} took ${Math.round(run.durationMs / 1000)} seconds.`,
          'Check whether the run is still within an acceptable duration.',
        ),
      );
    }
    if (pricingGap(run)) {
      drafts.push(
        runException(
          run,
          'low',
          'pricing',
          `${run.agentName} has no usable price for this run.`,
          'Pricing data is unavailable. The cost on this run should not be treated as a total.',
        ),
      );
    }
  }
  return drafts;
}

function pricingGap(run: RunEvidence) {
  if (run.costStatus === 'pricing_not_configured') return true;
  return (
    run.costStatus === 'usage_unavailable' &&
    run.agentName !== 'knowledge-embedding'
  );
}

function runException(
  run: RunEvidence,
  severity: ExceptionSeverity,
  rule: string,
  description: string,
  action: string,
): ExceptionDraft {
  return draft({
    exceptionKey: `run:${run.id}:${rule}`,
    category: 'ai_automation',
    severity,
    title: `AI run needs review: ${clip(run.agentName, 80)}`,
    description,
    sourceType: 'agent_run',
    sourceId: run.id,
    recommendedAction: action,
    recommendedActionType: 'review_run',
    metadata: { rule, daysOverdue: 0 },
  });
}

function approvalDraft(
  approval: ApprovalEvidence,
  now: Date,
  config: DetectionConfig,
): ExceptionDraft | null {
  if (approval.status === 'failed') {
    return approvalException(
      approval,
      'high',
      'failed',
      'An approved action failed during execution and was not retried automatically.',
      'Open the approval and review the safe error before deciding on a new request.',
    );
  }
  if (approval.status === 'expired') {
    return approvalException(
      approval,
      'medium',
      'expired',
      'This approval expired before anyone executed it.',
      'Create a new approval only if the business action is still wanted.',
    );
  }
  const ageHours =
    (now.getTime() - approval.createdAt.getTime()) / (60 * 60 * 1000);
  if (
    approval.status === 'pending' &&
    approval.expiresAt.getTime() > now.getTime() &&
    ageHours >= config.approvalPendingHours
  ) {
    return approvalException(
      approval,
      'high',
      'pending',
      `This approval has been waiting for ${Math.floor(ageHours)} hours.`,
      'Approve, reject, or cancel it in the Approval Center.',
    );
  }
  return null;
}

function approvalException(
  approval: ApprovalEvidence,
  severity: ExceptionSeverity,
  rule: string,
  description: string,
  action: string,
): ExceptionDraft {
  return draft({
    exceptionKey: `approval:${approval.id}:${rule}`,
    category: 'approval',
    severity,
    title: `Approval needs attention: ${clip(approval.title, 100)}`,
    description,
    sourceType: 'ai_approval',
    sourceId: approval.id,
    recommendedAction: action,
    recommendedActionType: 'review_approval',
    metadata: { rule, actionType: approval.actionType, daysOverdue: 0 },
  });
}

function draft(input: ExceptionDraft): ExceptionDraft {
  const priority = priorityFor(input, 1, false);
  return {
    ...input,
    title: clip(redact(input.title), 200),
    description: clip(redact(input.description), 500),
    recommendedAction: clip(redact(input.recommendedAction), 300),
    metadata: { ...sanitize(input.metadata), priorityReason: priority.reason },
  };
}

function sanitize(value: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_TEST.test(key)) continue;
    if (typeof entry === 'string') output[key] = clip(redact(entry), 160);
    else if (
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    )
      output[key] = entry;
  }
  return output;
}

function redact(value: string) {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(SECRET, '[redacted]');
}

function clip(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max);
}
