export const OPPORTUNITY_TYPES = [
  'cross_sell',
  'upsell',
  'customer_expansion',
  'customer_requested_service',
  'lead_conversion',
  'stalled_sales',
  're_engagement',
  'proposal_follow_up',
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_STATUSES = [
  'identified',
  'needs_review',
  'qualified',
  'action_planned',
  'in_progress',
  'converted',
  'won',
  'lost',
  'dismissed',
  'closed',
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const DEFAULT_GROWTH_THRESHOLDS = {
  leadQuietDays: 21,
  proposalFollowUpDays: 7,
};

export type GrowthThresholds = typeof DEFAULT_GROWTH_THRESHOLDS;

const TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  identified: ['needs_review', 'dismissed'],
  needs_review: ['qualified', 'dismissed', 'closed'],
  qualified: ['action_planned', 'dismissed'],
  action_planned: ['in_progress', 'dismissed'],
  in_progress: ['converted', 'won', 'lost', 'closed', 'dismissed'],
  converted: ['closed'],
  won: ['closed'],
  lost: ['closed'],
  dismissed: [],
  closed: [],
};

const UPSELL =
  /\b(expand the scope|broader scope|increase the scope|add to (the|our) (current|existing) (proposal|scope|service))\b/i;
const CROSS =
  /\b(another service|additional service|different service|other service)\b/i;
const EXPANSION =
  /\b(new project|additional requirement|more requirements|expanding (our|the) business)\b/i;
const INTENT =
  /\b(ready to (proceed|move forward)|send (me |us )?a proposal|want to move forward)\b/i;
const REVISION =
  /\b(revise the proposal|revision to the proposal|please revise)\b/i;

export type GrowthMessage = {
  id: string;
  companyId: string | null;
  leadId: string | null;
  content: string;
  createdAt: Date;
  direction?: string | null;
  conversationId?: string | null;
};
export type GrowthProspect = {
  id: string;
  companyId: string;
  leadId: string;
  name: string;
  updatedAt: Date;
};
export type GrowthConversation = {
  id: string;
  companyId: string | null;
  leadId: string | null;
  status: string;
  updatedAt: Date;
};
export type GrowthProposal = {
  id: string;
  companyId: string;
  prospectId: string;
  leadId: string | null;
  title: string;
  status: string;
  sentAt: Date | null;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  validUntil: Date | null;
};
export type GrowthLead = {
  id: string;
  companyId: string;
  name: string;
  status: string;
  updatedAt: Date;
};
export type GrowthTask = {
  id: string;
  leadId: string | null;
  companyId: string | null;
  prospectId?: string | null;
  status: string;
  dueAt: Date | null;
  updatedAt: Date;
};

export type GrowthEvidence = {
  now: Date;
  leads: GrowthLead[];
  prospects?: GrowthProspect[];
  proposals: GrowthProposal[];
  messages: GrowthMessage[];
  tasks: GrowthTask[];
  conversations?: GrowthConversation[];
  acceptedCompanyIds: string[];
};

export type DiscoveredOpportunity = {
  signalKey: string;
  type: OpportunityType;
  title: string;
  description: string;
  evidence: string;
  explicit: boolean;
  companyId: string;
  leadId: string | null;
  prospectId: string | null;
  proposalId: string | null;
  sourceType: string;
  sourceId: string;
  priority: 'high' | 'medium' | 'low';
  priorityRank: 1 | 2 | 3;
  confidence: 'high' | 'medium' | 'low';
  action: string;
};

export function validateGrowthThresholds(
  input: Partial<GrowthThresholds>,
): { ok: true; value: GrowthThresholds } | { ok: false; error: string } {
  const value = { ...DEFAULT_GROWTH_THRESHOLDS, ...input };
  for (const field of ['leadQuietDays', 'proposalFollowUpDays'] as const) {
    const days = value[field];
    if (!Number.isInteger(days) || days < 1 || days > 365)
      return {
        ok: false,
        error: `${field} must be a whole number from 1 to 365.`,
      };
  }
  return { ok: true, value };
}

export function canTransitionOpportunity(
  from: OpportunityStatus,
  to: OpportunityStatus,
) {
  return TRANSITIONS[from].includes(to);
}

export function priorityRank(
  priority: DiscoveredOpportunity['priority'],
): 1 | 2 | 3 {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function daysBefore(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function excerpt(text: string, pattern: RegExp) {
  const match = text.slice(0, 2000).match(pattern);
  if (!match || match.index === undefined) return null;
  return text
    .slice(Math.max(0, match.index - 30), match.index + 120)
    .replace(/\s+/g, ' ')
    .trim();
}

function push(list: DiscoveredOpportunity[], item: DiscoveredOpportunity) {
  if (list.some((row) => row.signalKey === item.signalKey)) return;
  list.push(item);
}

export function discoverOpportunities(
  input: GrowthEvidence,
  thresholds: GrowthThresholds,
): { opportunities: DiscoveredOpportunity[]; insufficientLeads: number } {
  const accepted = new Set(input.acceptedCompanyIds);
  const opportunities: DiscoveredOpportunity[] = [];
  const quietBefore = daysBefore(input.now, thresholds.leadQuietDays);
  const followBefore = daysBefore(input.now, thresholds.proposalFollowUpDays);
  let insufficientLeads = 0;

  for (const message of input.messages) {
    const upsell = excerpt(message.content, UPSELL);
    const cross = excerpt(message.content, CROSS);
    const expansion = excerpt(message.content, EXPANSION);
    const quote = upsell ?? cross ?? expansion;
    if (!quote || !message.companyId) continue;
    const customer = accepted.has(message.companyId);
    const type: OpportunityType = !customer
      ? 'customer_requested_service'
      : upsell
        ? 'upsell'
        : cross
          ? 'cross_sell'
          : 'customer_expansion';
    const existing = customer
      ? input.proposals.find(
          (proposal) =>
            proposal.companyId === message.companyId &&
            proposal.status === 'accepted',
        )
      : undefined;
    push(opportunities, {
      signalKey: `${type}:message:${message.id}`,
      type,
      title:
        type === 'upsell'
          ? 'Review an explicit scope request'
          : type === 'cross_sell'
            ? 'Review an explicit request for another service'
            : type === 'customer_requested_service'
              ? 'Review an explicit request before any offer'
              : 'Review an explicit expansion remark',
      description: customer
        ? 'The stored message contains the customer’s words. This is not a confirmed order and it does not name a service that is absent from the message.'
        : 'The stored message contains an explicit request. There is no accepted proposal, so this is not treated as cross-sell or upsell.',
      evidence: existing
        ? `Quote: "${quote}". An accepted proposal titled "${existing.title}" shows an existing relationship. No price is inferred.`
        : `Quote: "${quote}". No price is inferred.`,
      explicit: true,
      companyId: message.companyId,
      leadId: message.leadId,
      prospectId: null,
      proposalId: existing?.id ?? null,
      sourceType: 'message',
      sourceId: message.id,
      priority: 'high',
      priorityRank: 3,
      confidence: 'high',
      action:
        'A person should read the message before any proposal or outreach. Do not invent a service, price, or budget.',
    });
  }

  const prospects = input.prospects ?? [];
  const conversations = input.conversations ?? [];
  const overdueLeadIds = new Set<string>();
  const overdueProspectIds = new Set<string>();

  for (const task of input.tasks) {
    if (!task.companyId || accepted.has(task.companyId)) continue;
    if (
      !['pending', 'in_progress'].includes(task.status) ||
      !task.dueAt ||
      task.dueAt >= input.now
    )
      continue;
    if (task.leadId) overdueLeadIds.add(task.leadId);
    if (task.prospectId) overdueProspectIds.add(task.prospectId);
    push(opportunities, {
      signalKey: `stalled_sales:task:${task.id}`,
      type: 'stalled_sales',
      title: 'Review an overdue follow-up task',
      description:
        'A stored task is past its due time. This is not a lost sale and it does not create a deal value.',
      evidence: `Task ${task.id} was due at ${task.dueAt.toISOString()} and its status is ${task.status}.`,
      explicit: false,
      companyId: task.companyId,
      leadId: task.leadId,
      prospectId: task.prospectId ?? null,
      proposalId: null,
      sourceType: 'task',
      sourceId: task.id,
      priority: 'medium',
      priorityRank: 2,
      confidence: 'medium',
      action:
        'Complete or reassign the existing task. Do not invent a deal stage.',
    });
  }

  for (const proposal of input.proposals) {
    if (accepted.has(proposal.companyId)) continue;
    const followUp = linkedTaskState(input.tasks, proposal, input.now);
    const revision = revisionQuote(input.messages, proposal.companyId);
    const taskNote =
      followUp === 'none' ? ' No open follow-up task is stored.' : '';
    if (proposal.status === 'rejected') {
      if (!proposal.rejectionReason?.trim() && !revision) continue;
      const reason = proposal.rejectionReason?.trim()
        ? `Rejection reason: "${proposal.rejectionReason.slice(0, 180)}". This does not create a new offer.`
        : 'A stored message asks for a revision. No rejection reason is stored.';
      push(
        opportunities,
        mentionedProposal(
          proposal,
          'Review the recorded proposal response',
          `${revision ? `Quote: "${revision}". ` : ''}${reason}${taskNote}`,
          revision ? 'high' : 'low',
          revision ? 3 : 1,
          'medium',
          Boolean(revision),
        ),
      );
      continue;
    }
    if (
      proposal.status === 'expired' ||
      (proposal.validUntil &&
        proposal.validUntil < input.now &&
        ['sent', 'viewed'].includes(proposal.status))
    ) {
      push(
        opportunities,
        mentionedProposal(
          proposal,
          'Review an expired proposal',
          `${revision ? `Quote: "${revision}". ` : ''}Proposal "${proposal.title}" is expired or past validUntil. Expiration is not a lost sale until someone records that outcome.${taskNote}`,
          revision ? 'high' : 'medium',
          revision ? 3 : 2,
          'medium',
          Boolean(revision),
        ),
      );
      continue;
    }
    if (followUp !== 'none') continue;
    if (
      proposal.status === 'viewed' &&
      proposal.viewedAt &&
      proposal.viewedAt <= followBefore
    ) {
      push(
        opportunities,
        mentionedProposal(
          proposal,
          'Follow up a viewed proposal',
          `${revision ? `Quote: "${revision}". ` : ''}Proposal "${proposal.title}" was viewed and no later decision is stored. Viewing is not acceptance.${taskNote}`,
          revision ? 'high' : 'medium',
          revision ? 3 : 2,
          'medium',
          Boolean(revision),
        ),
      );
      continue;
    }
    if (
      proposal.status === 'sent' &&
      proposal.sentAt &&
      proposal.sentAt <= followBefore &&
      !proposal.viewedAt
    ) {
      push(
        opportunities,
        mentionedProposal(
          proposal,
          'Follow up a sent proposal',
          `${revision ? `Quote: "${revision}". ` : ''}Proposal "${proposal.title}" was sent and no view or decision is stored.${taskNote}`,
          revision ? 'high' : 'medium',
          revision ? 3 : 2,
          'low',
          Boolean(revision),
        ),
      );
    }
  }

  const prospectLeadIds = new Set<string>();
  for (const prospect of prospects) {
    prospectLeadIds.add(prospect.leadId);
    if (
      accepted.has(prospect.companyId) ||
      overdueLeadIds.has(prospect.leadId) ||
      overdueProspectIds.has(prospect.id)
    )
      continue;
    if (
      hasOpenTask(input.tasks, prospect.leadId, prospect.id, input.now) ||
      prospect.updatedAt > quietBefore
    )
      continue;
    const hadMessage = input.messages.some(
      (message) => message.leadId === prospect.leadId,
    );
    push(
      opportunities,
      quietRecord({
        type: hadMessage ? 're_engagement' : 'stalled_sales',
        signalKey: `${hadMessage ? 're_engagement' : 'stalled_sales'}:prospect:${prospect.id}`,
        title: hadMessage
          ? 'Re-engage a quiet prospect'
          : 'Review a quiet prospect',
        description: hadMessage
          ? 'A stored message exists and the prospect has no update inside the configured window. This is not a lost sale.'
          : 'The prospect has no stored update inside the configured window. This is not a lost sale.',
        evidence: `${prospect.name} was last updated at ${prospect.updatedAt.toISOString()}.`,
        companyId: prospect.companyId,
        leadId: prospect.leadId,
        prospectId: prospect.id,
        sourceType: 'prospect',
        sourceId: prospect.id,
      }),
    );
  }

  for (const lead of input.leads) {
    if (['converted', 'lost', 'unqualified'].includes(lead.status)) continue;
    const intent = input.messages.find(
      (message) => message.leadId === lead.id && INTENT.test(message.content),
    );
    if (intent) {
      const quote = excerpt(intent.content, INTENT);
      push(opportunities, {
        signalKey: `lead_conversion:message:${intent.id}`,
        type: 'lead_conversion',
        title: 'Review explicit buying words before any conversion',
        description:
          'A stored message matches buying-intent language. The lead is not converted by this finding.',
        evidence: quote
          ? `Quote: "${quote}".`
          : 'The message matched a buying-intent phrase.',
        explicit: true,
        companyId: lead.companyId,
        leadId: lead.id,
        prospectId: null,
        proposalId: null,
        sourceType: 'message',
        sourceId: intent.id,
        priority: 'high',
        priorityRank: 3,
        confidence: 'high',
        action:
          'A person should qualify the lead in the existing CRM. Do not convert it automatically.',
      });
      continue;
    }
    if (
      accepted.has(lead.companyId) ||
      prospectLeadIds.has(lead.id) ||
      overdueLeadIds.has(lead.id)
    )
      continue;
    const history = hasLeadHistory(input, lead.id);
    const recentMessage = input.messages.some(
      (message) =>
        message.leadId === lead.id && message.createdAt > quietBefore,
    );
    const recentTask = input.tasks.some(
      (task) =>
        task.leadId === lead.id &&
        ['pending', 'in_progress'].includes(task.status) &&
        task.updatedAt > quietBefore,
    );
    if (
      recentMessage &&
      !input.proposals.some((proposal) => proposal.leadId === lead.id)
    ) {
      push(opportunities, {
        signalKey: `lead_conversion:lead:${lead.id}`,
        type: 'lead_conversion',
        title: 'Review stored messages before qualification',
        description:
          'Messages are stored, and no buying-intent phrase was found. This is not a conversion prediction.',
        evidence: `${lead.name} has a stored message inside the review window and no proposal is stored.`,
        explicit: false,
        companyId: lead.companyId,
        leadId: lead.id,
        prospectId: null,
        proposalId: null,
        sourceType: 'lead',
        sourceId: lead.id,
        priority: 'low',
        priorityRank: 1,
        confidence: 'low',
        action:
          'A person should decide whether more qualification or a proposal is appropriate. Do not convert the lead from this notice.',
      });
      continue;
    }
    if (lead.updatedAt > quietBefore || recentTask) {
      if (!history) insufficientLeads += 1;
      continue;
    }
    if (!lead.updatedAt) {
      insufficientLeads += 1;
      continue;
    }
    const hadMessage = input.messages.some(
      (message) => message.leadId === lead.id,
    );
    push(
      opportunities,
      quietRecord({
        type: hadMessage ? 're_engagement' : 'stalled_sales',
        signalKey: `${hadMessage ? 're_engagement' : 'stalled_sales'}:lead:${lead.id}`,
        title: hadMessage ? 'Re-engage a quiet lead' : 'Review a quiet lead',
        description: hadMessage
          ? 'A stored message exists and the lead has no update inside the configured window. This is not a lost sale.'
          : 'The lead has no stored update inside the configured window. This is not a lost sale.',
        evidence: `${lead.name} was last updated at ${lead.updatedAt.toISOString()}. Status remains ${lead.status}.`,
        companyId: lead.companyId,
        leadId: lead.id,
        prospectId: null,
        sourceType: 'lead',
        sourceId: lead.id,
      }),
    );
  }

  for (const conversation of conversations) {
    if (!conversation.companyId || accepted.has(conversation.companyId))
      continue;
    if (
      ['resolved', 'closed'].includes(conversation.status) ||
      conversation.updatedAt > quietBefore
    )
      continue;
    if (
      opportunities.some(
        (item) =>
          item.companyId === conversation.companyId &&
          ['stalled_sales', 're_engagement'].includes(item.type),
      )
    )
      continue;
    push(opportunities, {
      signalKey: `stalled_sales:conversation:${conversation.id}`,
      type: 'stalled_sales',
      title: 'Review an unresolved sales conversation',
      description:
        'The conversation is still open past the configured window. This is not a lost sale.',
      evidence: `Conversation ${conversation.id} status is ${conversation.status} and it was updated at ${conversation.updatedAt.toISOString()}.`,
      explicit: false,
      companyId: conversation.companyId,
      leadId: conversation.leadId,
      prospectId: null,
      proposalId: null,
      sourceType: 'conversation',
      sourceId: conversation.id,
      priority: 'medium',
      priorityRank: 2,
      confidence: 'low',
      action:
        'A person should read the conversation and record the next step. Do not send a message from this notice.',
    });
  }

  rememberUnanswered(opportunities, input.messages, accepted, followBefore);

  return { opportunities, insufficientLeads };
}

function mentionedProposal(
  proposal: GrowthProposal,
  title: string,
  evidence: string,
  priority: DiscoveredOpportunity['priority'],
  rank: 1 | 2 | 3,
  confidence: DiscoveredOpportunity['confidence'],
  explicit: boolean,
): DiscoveredOpportunity {
  return {
    signalKey: `proposal_follow_up:proposal:${proposal.id}`,
    type: 'proposal_follow_up',
    title,
    description:
      'The proposal record supports a follow-up review. No discount or acceptance is implied.',
    evidence,
    explicit,
    companyId: proposal.companyId,
    leadId: proposal.leadId,
    prospectId: proposal.prospectId,
    proposalId: proposal.id,
    sourceType: 'proposal',
    sourceId: proposal.id,
    priority,
    priorityRank: rank,
    confidence,
    action:
      'Review the proposal in the existing proposal screen before anyone writes to the customer.',
  };
}

function quietRecord(input: {
  type: 'stalled_sales' | 're_engagement';
  signalKey: string;
  title: string;
  description: string;
  evidence: string;
  companyId: string;
  leadId: string;
  prospectId: string | null;
  sourceType: string;
  sourceId: string;
}): DiscoveredOpportunity {
  return {
    ...input,
    explicit: false,
    proposalId: null,
    priority: 'low',
    priorityRank: 1,
    confidence: 'low',
    action:
      'Decide whether a person should follow up. Do not close the record from this notice.',
  };
}

function linked(task: GrowthTask, proposal: GrowthProposal) {
  if (proposal.leadId && task.leadId === proposal.leadId) return true;
  return Boolean(task.prospectId && task.prospectId === proposal.prospectId);
}

function linkedTaskState(
  tasks: GrowthTask[],
  proposal: GrowthProposal,
  now: Date,
): 'open' | 'overdue' | 'none' {
  const related = tasks.filter(
    (task) =>
      linked(task, proposal) &&
      ['pending', 'in_progress'].includes(task.status),
  );
  if (related.some((task) => task.dueAt && task.dueAt < now)) return 'overdue';
  if (related.length > 0) return 'open';
  return 'none';
}

function hasOpenTask(
  tasks: GrowthTask[],
  leadId: string,
  prospectId: string,
  now: Date,
) {
  return tasks.some((task) => {
    const matches = task.leadId === leadId || task.prospectId === prospectId;
    if (!matches || !['pending', 'in_progress'].includes(task.status))
      return false;
    return !task.dueAt || task.dueAt >= now;
  });
}

function hasLeadHistory(input: GrowthEvidence, leadId: string) {
  return (
    input.messages.some((message) => message.leadId === leadId) ||
    input.tasks.some((task) => task.leadId === leadId) ||
    input.proposals.some((proposal) => proposal.leadId === leadId)
  );
}

function revisionQuote(messages: GrowthMessage[], companyId: string) {
  const message = messages.find(
    (item) => item.companyId === companyId && REVISION.test(item.content),
  );
  return message ? excerpt(message.content, REVISION) : null;
}

function rememberUnanswered(
  opportunities: DiscoveredOpportunity[],
  messages: GrowthMessage[],
  accepted: Set<string>,
  followBefore: Date,
) {
  const seen = new Set<string>();
  for (const message of messages) {
    if (
      !message.companyId ||
      !message.conversationId ||
      accepted.has(message.companyId) ||
      message.createdAt > followBefore
    )
      continue;
    if (seen.has(message.conversationId)) continue;
    if (
      opportunities.some(
        (item) =>
          item.companyId === message.companyId &&
          ['stalled_sales', 're_engagement', 'proposal_follow_up'].includes(
            item.type,
          ),
      )
    )
      continue;
    if (message.direction === 'inbound') {
      const replied = messages.some(
        (other) =>
          other.conversationId === message.conversationId &&
          other.direction === 'outbound' &&
          other.createdAt > message.createdAt,
      );
      if (replied) continue;
      seen.add(message.conversationId);
      push(opportunities, {
        signalKey: `stalled_sales:message:${message.id}`,
        type: 'stalled_sales',
        title: 'Review an unanswered inbound message',
        description:
          'An inbound message has no later outbound message in the same conversation. This is not a lost sale.',
        evidence: `Message ${message.id} is inbound and no later outbound message is stored.`,
        explicit: false,
        companyId: message.companyId,
        leadId: message.leadId,
        prospectId: null,
        proposalId: null,
        sourceType: 'message',
        sourceId: message.id,
        priority: 'medium',
        priorityRank: 2,
        confidence: 'medium',
        action:
          'A person should reply through the Communication Hub. This notice does not send a message.',
      });
    }
    if (message.direction === 'outbound') {
      const replied = messages.some(
        (other) =>
          other.conversationId === message.conversationId &&
          other.direction === 'inbound' &&
          other.createdAt > message.createdAt,
      );
      if (replied) continue;
      seen.add(message.conversationId);
      push(opportunities, {
        signalKey: `re_engagement:message:${message.id}`,
        type: 're_engagement',
        title: 'Review an outbound message with no stored reply',
        description:
          'An outbound message has no later inbound reply. Silence is not a lost sale.',
        evidence: `Message ${message.id} is outbound and no later inbound reply is stored.`,
        explicit: false,
        companyId: message.companyId,
        leadId: message.leadId,
        prospectId: null,
        proposalId: null,
        sourceType: 'message',
        sourceId: message.id,
        priority: 'low',
        priorityRank: 1,
        confidence: 'low',
        action:
          'Decide whether a person should follow up. Do not treat silence as a rejection.',
      });
    }
  }
}

export function shouldOpenGrowth(existingKeys: string[], key: string) {
  return !existingKeys.includes(key);
}

export function growthTaskMarker(opportunityId: string) {
  return `growth-opportunity:${opportunityId}`;
}

export function growthDraft(
  companyName: string,
  kind: 'general' | 'proposal' | 'expansion' = 'general',
) {
  const cleaned = companyName
    .replace(/[\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const name = /[%$€£]|\d/.test(cleaned) ? '' : cleaned;
  const line =
    kind === 'proposal'
      ? 'I am following up on the proposal already on record.'
      : kind === 'expansion'
        ? 'I am following up on the request already in our conversation.'
        : 'I am following up on the work we already have on record.';
  return {
    body: [
      name ? `Hello ${name},` : 'Hello,',
      '',
      line,
      'This draft was prepared for an internal reviewer and has not been sent.',
      'Supporting records stay with the reviewer and are not copied here.',
    ].join('\n'),
    sent: false,
    authorKind: 'ai' as const,
    note: 'No price, discount, promise, or service catalog item is included. Sending stays in Communication Hub, which enforces consent and approval.',
  };
}

export function summarizeGrowth(input: {
  types: string[];
  statuses: string[];
  priorities?: string[];
  highPriority: number;
  awaitingReview: number;
  withPlans: number;
  overdueLinked: number;
  insufficientLeads: number;
}) {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const type of input.types) byType[type] = (byType[type] ?? 0) + 1;
  for (const status of input.statuses)
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  for (const priority of input.priorities ?? [])
    byPriority[priority] = (byPriority[priority] ?? 0) + 1;
  return {
    total: input.types.length,
    byType,
    byStatus,
    byPriority,
    highPriority: input.highPriority,
    awaitingReview: input.awaitingReview,
    withPlans: input.withPlans,
    overdueLinked: input.overdueLinked,
    won: byStatus.won ?? 0,
    lost: byStatus.lost ?? 0,
    converted: byStatus.converted ?? 0,
    insufficientLeads: input.insufficientLeads,
    revenue: null,
    proposalValue: null,
    conversionRate: null,
    method: 'heuristic' as const,
    predictiveModel: false,
    scoring:
      'Rank 3 is an explicit stored request, rank 2 is a dated proposal follow-up or an overdue task, and rank 1 is a quiet lead or prospect. The rank is not a probability and not a currency amount.',
    note: 'Counts are stored opportunities. Priority is not money. Proposal amounts are not revenue. Won, lost, and converted counts are status values a person or an existing CRM record confirmed. No conversion rate is calculated.',
  };
}

export function growthException(
  companyId: string,
  opportunity: DiscoveredOpportunity,
) {
  if (
    !['stalled_sales', 'proposal_follow_up', 're_engagement'].includes(
      opportunity.type,
    ) &&
    opportunity.priority !== 'high'
  )
    return null;
  return {
    exceptionKey: `growth:${opportunity.signalKey}`,
    category: 'sales' as const,
    severity:
      opportunity.priority === 'high' ? ('high' as const) : ('medium' as const),
    title: opportunity.title,
    description: opportunity.evidence.slice(0, 500),
    sourceType: 'company',
    sourceId: companyId,
    recommendedAction:
      'Open the growth opportunity and review the source record.',
    recommendedActionType: 'review_growth',
    metadata: { signalKey: opportunity.signalKey, type: opportunity.type },
  };
}

export type GrowthMonitorRow = {
  id: string;
  signalKey: string;
  type: string;
  title: string;
  evidence: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  companyId: string;
  hasPlan: boolean;
  taskOverdue: boolean;
};

export function monitorGrowth(row: GrowthMonitorRow) {
  const open = !['dismissed', 'closed', 'won', 'lost', 'converted'].includes(
    row.status,
  );
  if (!open) return [];
  const drafts: Array<ReturnType<typeof monitorDraft>> = [];
  if (
    !row.assignedTo &&
    (row.priority === 'high' ||
      ['stalled_sales', 'proposal_follow_up', 're_engagement'].includes(
        row.type,
      ))
  ) {
    drafts.push(
      monitorDraft(
        row,
        `growth:unassigned:${row.id}`,
        'sales',
        row.priority === 'high' ? 'high' : 'medium',
        'Unassigned growth opportunity',
        'Assign an owner or record why the opportunity can wait.',
      ),
    );
  }
  if (row.taskOverdue) {
    drafts.push(
      monitorDraft(
        row,
        `growth:overdue:${row.id}`,
        'task',
        'high',
        'Growth opportunity task is overdue',
        'Complete or reassign the existing task.',
      ),
    );
  }
  if (
    !row.hasPlan &&
    row.priority === 'high' &&
    ['identified', 'needs_review', 'qualified'].includes(row.status)
  ) {
    drafts.push(
      monitorDraft(
        row,
        `growth:no-plan:${row.id}`,
        'sales',
        'medium',
        'High-priority opportunity has no action plan',
        'Qualify it and create an action plan, or dismiss it with an outcome.',
      ),
    );
  }
  return drafts;
}

function monitorDraft(
  row: GrowthMonitorRow,
  exceptionKey: string,
  category: 'sales' | 'task',
  severity: 'high' | 'medium',
  title: string,
  recommendedAction: string,
) {
  return {
    exceptionKey,
    category,
    severity,
    title,
    description: row.evidence.slice(0, 500),
    sourceType: 'company',
    sourceId: row.companyId,
    recommendedAction,
    recommendedActionType: 'review_growth',
    metadata: {
      signalKey: row.signalKey,
      opportunityId: row.id,
      type: row.type,
    },
  };
}
