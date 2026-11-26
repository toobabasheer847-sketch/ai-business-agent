import { isOptOutKeyword } from '../omnichannel/communication-rules';

export const HEALTH = ['healthy', 'attention_needed', 'at_risk', 'insufficient_data'] as const;
export type HealthClass = (typeof HEALTH)[number];

export const DEFAULT_THRESHOLDS = {
  inactivityDays: 30,
  unansweredDays: 3,
  stalledProposalDays: 14,
  unresolvedConversationDays: 7,
  followUpDueDays: 2,
};

export type RetentionThresholds = typeof DEFAULT_THRESHOLDS;

export type EvidenceMessage = {
  id: string;
  conversationId: string;
  direction: string | null;
  content: string;
  createdAt: Date;
};

export type EvidenceConversation = {
  id: string;
  status: string;
  updatedAt: Date;
};

export type EvidenceProposal = {
  id: string;
  title: string;
  status: string;
  sentAt: Date | null;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
};

export type EvidenceTask = {
  id: string;
  title: string;
  status: string;
  dueAt: Date | null;
};

export type CustomerEvidence = {
  companyId: string;
  companyName: string;
  proposals: EvidenceProposal[];
  conversations: EvidenceConversation[];
  messages: EvidenceMessage[];
  tasks: EvidenceTask[];
  now: Date;
};

export type RetentionSignal = {
  code: string;
  sourceType: string;
  sourceId: string;
  observedAt: string;
  summary: string;
  fact: true;
};

export type RelationshipAssessment = {
  classification: HealthClass;
  method: 'heuristic';
  predictiveModel: false;
  churnProbability: null;
  confidence: 'none' | 'low' | 'medium' | 'high';
  dataSufficiency: 'insufficient' | 'limited' | 'adequate';
  signals: RetentionSignal[];
  explanation: string;
  lastInteractionAt: string | null;
};

const COMPLAINT = /\b(complaint|complain|unhappy|disappointed|frustrated|refund|terrible|awful)\b/i;
const PRAISE = /\b(thank you|thanks|grateful|satisfied|appreciate)\b/i;
const CONCERN = /\b(concerned|worried|problem)\b/i;

export function validateThresholds(input: Partial<RetentionThresholds>): { ok: true; value: RetentionThresholds } | { ok: false; error: string } {
  const value = { ...DEFAULT_THRESHOLDS, ...input };
  const fields: Array<keyof RetentionThresholds> = [
    'inactivityDays',
    'unansweredDays',
    'stalledProposalDays',
    'unresolvedConversationDays',
    'followUpDueDays',
  ];
  for (const field of fields) {
    const days = value[field];
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return { ok: false, error: `${field} must be a whole number from 1 to 365.` };
    }
  }
  if (value.unansweredDays > value.inactivityDays) {
    return { ok: false, error: 'unansweredDays cannot be longer than inactivityDays.' };
  }
  return { ok: true, value };
}

function daysBefore(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function latest(dates: Array<Date | null | undefined>) {
  const valid = dates.filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((value) => value.getTime())));
}

export function explicitFeedback(message: EvidenceMessage): { polarity: 'explicit_positive' | 'explicit_negative' | 'explicit_concern'; excerpt: string } | null {
  const text = message.content.slice(0, 2000);
  if (isOptOutKeyword(text)) return null;
  const match = text.match(COMPLAINT) ?? text.match(PRAISE) ?? text.match(CONCERN);
  if (!match || match.index === undefined) return null;
  const polarity = COMPLAINT.test(match[0]) ? 'explicit_negative' : PRAISE.test(match[0]) ? 'explicit_positive' : 'explicit_concern';
  const start = Math.max(0, match.index - 40);
  return { polarity, excerpt: text.slice(start, start + 180) };
}

export function assessRelationship(input: CustomerEvidence, thresholds: RetentionThresholds): RelationshipAssessment {
  const accepted = input.proposals.filter((proposal) => proposal.status === 'accepted');
  if (!accepted.length) {
    return {
      classification: 'insufficient_data',
      method: 'heuristic',
      predictiveModel: false,
      churnProbability: null,
      confidence: 'none',
      dataSufficiency: 'insufficient',
      signals: [],
      explanation: 'This company has no accepted proposal, so it is not assessed as a retained customer.',
      lastInteractionAt: null,
    };
  }
  const signals: RetentionSignal[] = [];
  const unansweredCutoff = daysBefore(input.now, thresholds.unansweredDays);
  const unresolvedCutoff = daysBefore(input.now, thresholds.unresolvedConversationDays);
  const stalledCutoff = daysBefore(input.now, thresholds.stalledProposalDays);
  const inactiveCutoff = daysBefore(input.now, thresholds.inactivityDays);

  for (const message of input.messages) {
    if (message.direction !== 'inbound') continue;
    if (message.createdAt > unansweredCutoff) continue;
    const laterOutbound = input.messages.some((other) =>
      other.conversationId === message.conversationId
      && other.direction === 'outbound'
      && other.createdAt > message.createdAt,
    );
    if (laterOutbound) continue;
    signals.push({
      code: 'unanswered_message',
      sourceType: 'message',
      sourceId: message.id,
      observedAt: message.createdAt.toISOString(),
      summary: 'An inbound message has no later outbound message in the same conversation.',
      fact: true,
    });
  }

  for (const conversation of input.conversations) {
    if (['resolved', 'closed'].includes(conversation.status)) continue;
    if (conversation.updatedAt > unresolvedCutoff) continue;
    signals.push({
      code: 'unresolved_conversation',
      sourceType: 'conversation',
      sourceId: conversation.id,
      observedAt: conversation.updatedAt.toISOString(),
      summary: `Conversation status is ${conversation.status} and it has not been updated within the configured window.`,
      fact: true,
    });
  }

  for (const task of input.tasks) {
    if (!['pending', 'in_progress'].includes(task.status) || !task.dueAt || task.dueAt >= input.now) continue;
    signals.push({
      code: 'overdue_task',
      sourceType: 'task',
      sourceId: task.id,
      observedAt: task.dueAt.toISOString(),
      summary: `Task "${task.title}" is ${task.status} and its due time is in the past.`,
      fact: true,
    });
  }

  for (const proposal of input.proposals) {
    if (!['sent', 'viewed'].includes(proposal.status)) continue;
    const marker = proposal.viewedAt ?? proposal.sentAt;
    if (!marker || marker > stalledCutoff) continue;
    signals.push({
      code: 'stalled_proposal',
      sourceType: 'proposal',
      sourceId: proposal.id,
      observedAt: marker.toISOString(),
      summary: `Proposal "${proposal.title}" is still ${proposal.status}.`,
      fact: true,
    });
  }

  const rejected = input.proposals.filter((proposal) => proposal.status === 'rejected');
  if (rejected.length >= 2) {
    signals.push({
      code: 'repeated_rejection',
      sourceType: 'proposal',
      sourceId: rejected[0].id,
      observedAt: (rejected[0].rejectedAt ?? input.now).toISOString(),
      summary: `${rejected.length} proposals for this company are stored as rejected. This is not a churn label.`,
      fact: true,
    });
  }

  for (const message of input.messages) {
    if (isOptOutKeyword(message.content)) {
      signals.push({
        code: 'opt_out_keyword',
        sourceType: 'message',
        sourceId: message.id,
        observedAt: message.createdAt.toISOString(),
        summary: 'The message is an opt-out keyword. It is not treated as proof the customer left.',
        fact: true,
      });
      continue;
    }
    const feedback = explicitFeedback(message);
    if (!feedback || feedback.polarity === 'explicit_positive') continue;
    signals.push({
      code: feedback.polarity === 'explicit_negative' ? 'explicit_complaint' : 'explicit_concern',
      sourceType: 'message',
      sourceId: message.id,
      observedAt: message.createdAt.toISOString(),
      summary: `The message contains the phrase "${feedback.excerpt}".`,
      fact: true,
    });
  }

  const categories = [
    input.messages.length > 0,
    input.conversations.length > 0,
    input.tasks.length > 0,
    input.proposals.some((proposal) => proposal.status !== 'accepted' || proposal.sentAt || proposal.viewedAt),
  ].filter(Boolean).length;

  const lastInteraction = latest([
    ...input.messages.map((message) => message.createdAt),
    ...input.conversations.map((conversation) => conversation.updatedAt),
    ...input.tasks.map((task) => task.dueAt),
    ...input.proposals.flatMap((proposal) => [proposal.sentAt, proposal.viewedAt, proposal.acceptedAt, proposal.rejectedAt]),
  ]);

  if (lastInteraction && lastInteraction <= inactiveCutoff && categories > 0) {
    signals.push({
      code: 'inactivity',
      sourceType: 'company',
      sourceId: input.companyId,
      observedAt: lastInteraction.toISOString(),
      summary: `The latest stored interaction is older than ${thresholds.inactivityDays} days.`,
      fact: true,
    });
  }

  const atRisk = signals.some((signal) =>
    ['unanswered_message', 'unresolved_conversation', 'overdue_task', 'explicit_complaint'].includes(signal.code),
  );
  const attention = signals.some((signal) =>
    ['stalled_proposal', 'repeated_rejection', 'explicit_concern', 'opt_out_keyword', 'inactivity'].includes(signal.code),
  );

  let classification: HealthClass = 'healthy';
  let explanation = 'Stored activity is inside the configured windows and no complaint, unanswered message, unresolved conversation, or overdue task was found.';
  if (categories === 0) {
    classification = 'insufficient_data';
    explanation = 'Only an accepted proposal is stored. Inactivity is not inferred, because this account has no communication, task, or later proposal history.';
  } else if (atRisk) {
    classification = 'at_risk';
    explanation = 'At least one stored complaint, unanswered inbound message, unresolved conversation, or overdue task met the configured threshold. This is a heuristic, not a churn probability.';
  } else if (attention) {
    classification = 'attention_needed';
    explanation = 'Stored records show inactivity, a stalled proposal, repeated rejections, a concern, or an opt-out keyword. The customer is not labeled churned.';
  }

  const confidence = categories >= 3 ? 'high' : categories === 2 ? 'medium' : categories === 1 ? 'low' : 'none';
  return {
    classification,
    method: 'heuristic',
    predictiveModel: false,
    churnProbability: null,
    confidence,
    dataSufficiency: categories >= 2 ? 'adequate' : categories === 1 ? 'limited' : 'insufficient',
    signals,
    explanation,
    lastInteractionAt: iso(lastInteraction),
  };
}

export function signalKey(signal: Pick<RetentionSignal, 'code' | 'sourceId'>) {
  return `${signal.code}:${signal.sourceId}`;
}

export function signalFingerprint(signals: RetentionSignal[]) {
  return signals.map(signalKey).sort().join('|');
}

export type RecommendationDraft = {
  signalKey: string;
  title: string;
  explanation: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  confidence: RelationshipAssessment['confidence'];
  sourceType: string;
  sourceId: string;
  evidence: string;
};

const RECOMMENDATIONS: Record<string, Omit<RecommendationDraft, 'signalKey' | 'confidence' | 'sourceType' | 'sourceId' | 'evidence'>> = {
  unanswered_message: {
    title: 'Respond to the unanswered message',
    explanation: 'An inbound message has no later outbound message in the same conversation.',
    action: 'Review the message and send a reply through the Communication Hub after approval.',
    priority: 'high',
  },
  unresolved_conversation: {
    title: 'Resolve the open conversation',
    explanation: 'The conversation is still open past the configured unresolved window.',
    action: 'Assign an owner and resolve or reopen the conversation with a recorded reason.',
    priority: 'high',
  },
  overdue_task: {
    title: 'Complete the overdue follow-up task',
    explanation: 'A task linked to this company is still open after its due time.',
    action: 'Complete or reschedule the existing task.',
    priority: 'high',
  },
  explicit_complaint: {
    title: 'Review the complaint in the customer’s words',
    explanation: 'A stored message contains explicit complaint language.',
    action: 'Read the source message and decide whether a person should respond. Do not invent a remedy.',
    priority: 'high',
  },
  stalled_proposal: {
    title: 'Review the stalled proposal',
    explanation: 'A proposal is still sent or viewed past the configured window.',
    action: 'Check the proposal record before contacting the customer.',
    priority: 'medium',
  },
  inactivity: {
    title: 'Review the quiet account',
    explanation: 'The latest stored interaction is older than the configured inactivity window.',
    action: 'Confirm whether a follow-up is appropriate. Do not treat silence as churn.',
    priority: 'medium',
  },
  repeated_rejection: {
    title: 'Review repeated proposal rejections',
    explanation: 'More than one proposal is stored as rejected.',
    action: 'Read the rejection records before proposing new work.',
    priority: 'medium',
  },
  explicit_concern: {
    title: 'Review the stated concern',
    explanation: 'A stored message contains explicit concern language.',
    action: 'Read the source message and record what was actually said.',
    priority: 'medium',
  },
  opt_out_keyword: {
    title: 'Honor the opt-out keyword',
    explanation: 'The message matches an opt-out keyword.',
    action: 'Do not send marketing. Confirm the communication preference already records the opt-out.',
    priority: 'high',
  },
};

export function recommend(assessment: RelationshipAssessment): RecommendationDraft[] {
  return assessment.signals.flatMap((signal) => {
    const template = RECOMMENDATIONS[signal.code];
    if (!template) return [];
    return [{
      ...template,
      signalKey: signalKey(signal),
      confidence: assessment.confidence,
      sourceType: signal.sourceType,
      sourceId: signal.sourceId,
      evidence: signal.summary,
    }];
  });
}

export function shouldOpenRecommendation(existingKeys: string[], key: string) {
  return !existingKeys.includes(key);
}

export function taskMarker(recommendationId: string) {
  return `retention-recommendation:${recommendationId}`;
}

export function retentionDraft(input: { companyName: string; classification: HealthClass; evidence: string[] }) {
  const name = input.companyName.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  const body = [
    name ? `Hello ${name},` : 'Hello,',
    '',
    'I am following up on our existing conversation.',
    'This draft was prepared for an internal reviewer and has not been sent.',
    input.evidence.length
      ? 'Supporting records are available to the assigned reviewer and are not copied into this message.'
      : 'No additional stored context was available.',
  ].join('\n');
  return {
    body,
    authorKind: 'ai' as const,
    sent: false,
    predictiveModel: false,
    classification: input.classification,
    note: 'Customer message text was not copied into this draft. Prices, discounts, and dates are not included.',
  };
}

export function summarizeRetention(input: {
  classifications: HealthClass[];
  inactive: number;
  openRecommendations: number;
  completedPlans: number;
  openPlans: number;
  overdueFollowUps: number;
  unresolvedConversations: number;
  truncated: boolean;
}) {
  const count = (value: HealthClass) => input.classifications.filter((item) => item === value).length;
  const plans = input.completedPlans + input.openPlans;
  return {
    customers: input.classifications.length,
    healthy: count('healthy'),
    attentionNeeded: count('attention_needed'),
    atRisk: count('at_risk'),
    insufficientData: count('insufficient_data'),
    inactive: input.inactive,
    openRecommendations: input.openRecommendations,
    completedPlans: input.completedPlans,
    openPlans: input.openPlans,
    overdueFollowUps: input.overdueFollowUps,
    unresolvedConversations: input.unresolvedConversations,
    followUpCompletion: plans === 0 ? null : {
      numerator: input.completedPlans,
      denominator: plans,
      percent: Math.round((input.completedPlans / plans) * 1000) / 10,
    },
    churnRate: null,
    retentionRate: null,
    customerLifetimeValue: null,
    method: 'heuristic' as const,
    predictiveModel: false,
    causalImpact: null,
    truncated: input.truncated,
    note: 'Counts are stored assessments. Classifications are heuristic. Churn rate, retention rate, and customer lifetime value are not calculated. Completing a plan is not evidence that churn was prevented.',
  };
}

export function exceptionDraftFor(companyId: string, companyName: string, signal: RetentionSignal) {
  const severe = ['explicit_complaint', 'unanswered_message', 'overdue_task'].includes(signal.code);
  if (!severe && signal.code !== 'unresolved_conversation' && signal.code !== 'inactivity') return null;
  return {
    exceptionKey: `retention:${companyId}:${signal.code}:${signal.sourceId}`,
    category: signal.code === 'overdue_task' ? 'task' as const : 'communication' as const,
    severity: severe ? 'high' as const : 'medium' as const,
    title: `${companyName}: ${signal.code.replaceAll('_', ' ')}`,
    description: signal.summary,
    sourceType: 'company',
    sourceId: companyId,
    recommendedAction: 'Open the customer retention record and review the linked source.',
    recommendedActionType: 'review_retention',
    metadata: { signal: signal.code, sourceId: signal.sourceId },
  };
}
