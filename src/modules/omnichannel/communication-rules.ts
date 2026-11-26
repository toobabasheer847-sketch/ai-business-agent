import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type Channel = (typeof CHANNELS)[number];

export const PURPOSES = ['transactional', 'customer_requested', 'marketing'] as const;
export type Purpose = (typeof PURPOSES)[number];

export const DELIVERY_STATUSES = [
  'pending',
  'pending_approval',
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'cancelled',
  'failed',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const TEMPLATE_VARIABLES = ['firstName', 'lastName', 'companyName', 'jobTitle'] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export const CHANNEL_PREF = ['unknown', 'allowed', 'opted_out'] as const;
export type ChannelPreference = (typeof CHANNEL_PREF)[number];

export const MARKETING_CONSENT = ['unknown', 'granted', 'denied', 'withdrawn'] as const;
export type MarketingConsent = (typeof MARKETING_CONSENT)[number];

export const LIMITS = {
  emailSubject: 200,
  emailBody: 4000,
  smsBody: 1600,
  whatsappBody: 4096,
  templateName: 120,
  campaignName: 160,
  campaignDescription: 500,
  evidence: 500,
  audienceMax: 200,
  maxAttempts: 3,
  outboundPerMinute: 30,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const VARIABLE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;
const OPT_OUT = /^(stop|stopall|unsubscribe|cancel|end|quit)[.!]?$/i;

const PERMANENT_SMS = new Set([
  '21211',
  '21214',
  '21408',
  '21610',
  '21614',
  '30004',
  '30005',
  '30006',
  '30007',
]);

const COMMERCIAL = [
  /\$\s?\d/,
  /\b\d+(?:\.\d+)?\s*%\s*off\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\bdelivery date\b/i,
  /\bin stock\b/i,
  /\bout of stock\b/i,
  /\bfree shipping\b/i,
  /\bour policy\b/i,
  /\bwe promise\b/i,
];

export type PreferenceSnapshot = {
  emailStatus: ChannelPreference;
  smsStatus: ChannelPreference;
  whatsappStatus: ChannelPreference;
  marketingConsent: MarketingConsent;
  restrictions: string | null;
};

export type ConsentDecision = {
  allowed: boolean;
  reason: string;
};

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) && email.length <= 255 ? email : null;
}

export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '');
  return E164.test(compact) ? compact : null;
}

export function normalizeRecipient(channel: Channel, value: string): string | null {
  if (channel === 'email') return normalizeEmail(value);
  return normalizePhone(value);
}

export function isOptOutKeyword(body: string): boolean {
  return OPT_OUT.test(body.trim());
}

function stricterChannel(current: ChannelPreference, next: ChannelPreference): ChannelPreference {
  if (current === 'opted_out' || next === 'opted_out') return 'opted_out';
  if (current === 'allowed' || next === 'allowed') return 'allowed';
  return 'unknown';
}

export function mergePreferences(rows: PreferenceSnapshot[]): PreferenceSnapshot | null {
  if (!rows.length) return null;
  const [first, ...rest] = rows;
  return rest.reduce<PreferenceSnapshot>((merged, row) => {
    const denied = row.marketingConsent === 'denied' || row.marketingConsent === 'withdrawn'
      || merged.marketingConsent === 'denied' || merged.marketingConsent === 'withdrawn';
    const granted = !denied && (row.marketingConsent === 'granted' || merged.marketingConsent === 'granted');
    return {
      emailStatus: stricterChannel(merged.emailStatus, row.emailStatus),
      smsStatus: stricterChannel(merged.smsStatus, row.smsStatus),
      whatsappStatus: stricterChannel(merged.whatsappStatus, row.whatsappStatus),
      marketingConsent: denied ? 'withdrawn' : granted ? 'granted' : 'unknown',
      restrictions: merged.restrictions || row.restrictions,
    };
  }, first);
}

export function channelStatus(
  preference: PreferenceSnapshot | null,
  channel: Channel,
): ChannelPreference {
  if (!preference) return 'unknown';
  if (channel === 'email') return preference.emailStatus;
  if (channel === 'sms') return preference.smsStatus;
  return preference.whatsappStatus;
}

export function evaluateConsent(input: {
  channel: Channel;
  purpose: Purpose;
  preference: PreferenceSnapshot | null;
  optOutAcknowledgement?: boolean;
}): ConsentDecision {
  const status = channelStatus(input.preference, input.channel);
  if (input.optOutAcknowledgement) {
    return status === 'opted_out'
      ? { allowed: true, reason: 'opt_out_acknowledgement' }
      : { allowed: false, reason: 'acknowledgement_without_opt_out' };
  }
  if (input.preference?.restrictions?.trim()) {
    return { allowed: false, reason: 'communication_restricted' };
  }
  if (status === 'opted_out') {
    return { allowed: false, reason: 'channel_opted_out' };
  }
  if (input.purpose === 'marketing') {
    if (input.preference?.marketingConsent === 'granted' && status !== 'unknown') {
      return { allowed: true, reason: 'marketing_consent_granted' };
    }
    if (input.preference?.marketingConsent === 'granted' && status === 'unknown') {
      return { allowed: false, reason: 'channel_preference_unknown' };
    }
    return { allowed: false, reason: 'marketing_consent_missing' };
  }
  return {
    allowed: true,
    reason: input.preference ? 'no_opt_out_on_record' : 'no_preference_on_record',
  };
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function secretsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyMetaSignature(rawBody: string, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=') || !appSecret || !rawBody) return false;
  const provided = header.slice('sha256='.length).trim().toLowerCase();
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return secretsMatch(expected, provided);
}

export function validateTemplate(content: string): { ok: true; variables: TemplateVariable[] } | { ok: false; error: string } {
  if (!content.trim()) return { ok: false, error: 'Template content is required.' };
  if (content.length > LIMITS.whatsappBody) return { ok: false, error: 'Template content is too long.' };
  const names: string[] = [];
  for (const match of content.matchAll(VARIABLE)) names.push(match[1]);
  const unique = [...new Set(names)];
  const unsupported = unique.filter((name) => !TEMPLATE_VARIABLES.includes(name as TemplateVariable));
  if (unsupported.length) {
    return { ok: false, error: `Unsupported template variables: ${unsupported.join(', ')}.` };
  }
  const stripped = content.replace(VARIABLE, '');
  if (stripped.includes('{{') || stripped.includes('}}')) {
    return { ok: false, error: 'Template variables must use {{name}} from the allowlist.' };
  }
  return { ok: true, variables: unique as TemplateVariable[] };
}

export function renderTemplate(
  content: string,
  values: Partial<Record<TemplateVariable, string>>,
): { ok: true; text: string } | { ok: false; error: string } {
  const validated = validateTemplate(content);
  if (!validated.ok) return validated;
  for (const name of validated.variables) {
    const value = values[name]?.trim();
    if (!value) return { ok: false, error: `Missing template value for ${name}.` };
    if (value.length > 200) return { ok: false, error: `Template value for ${name} is too long.` };
  }
  const text = content.replace(VARIABLE, (_, name: string) => values[name as TemplateVariable]!.trim());
  return { ok: true, text };
}

export function validateMessage(input: {
  channel: Channel;
  purpose: Purpose;
  body: string;
  subject?: string;
  providerTemplateRef?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const body = input.body?.trim() ?? '';
  if (input.channel === 'whatsapp' && input.purpose === 'marketing') {
    if (!input.providerTemplateRef?.trim()) {
      return { ok: false, error: 'WhatsApp marketing requires an approved provider template reference.' };
    }
  }
  if (input.channel !== 'whatsapp' || input.purpose !== 'marketing') {
    if (!body) return { ok: false, error: 'Message content is required.' };
  }
  if (input.channel === 'email') {
    if (!input.subject?.trim()) return { ok: false, error: 'Email subject is required.' };
    if ((input.subject?.trim().length ?? 0) > LIMITS.emailSubject) {
      return { ok: false, error: 'Email subject is too long.' };
    }
    if (body.length > LIMITS.emailBody) return { ok: false, error: 'Email body is too long.' };
  }
  if (input.channel === 'sms' && body.length > LIMITS.smsBody) {
    return { ok: false, error: 'SMS body is too long.' };
  }
  if (input.channel === 'whatsapp' && body.length > LIMITS.whatsappBody) {
    return { ok: false, error: 'WhatsApp body is too long.' };
  }
  return { ok: true };
}

const PROVIDER_TO_STATUS: Record<string, DeliveryStatus> = {
  accepted: 'sent',
  queued: 'sent',
  sending: 'sent',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  undelivered: 'failed',
};

export function mapProviderStatus(input: {
  channel: Channel;
  providerStatus: string | null | undefined;
  source: 'send' | 'callback';
}): { status: DeliveryStatus; deliveryConfirmed: boolean } {
  const raw = input.providerStatus?.trim().toLowerCase() ?? '';
  if (input.channel === 'email' && input.source === 'send') {
    return { status: 'sent', deliveryConfirmed: false };
  }
  const mapped = PROVIDER_TO_STATUS[raw];
  if (!mapped) return { status: input.source === 'send' ? 'sent' : 'pending', deliveryConfirmed: false };
  if (input.channel === 'email' && (mapped === 'delivered' || mapped === 'read')) {
    return { status: 'sent', deliveryConfirmed: false };
  }
  if (input.channel === 'sms' && mapped === 'read') {
    return { status: 'delivered', deliveryConfirmed: true };
  }
  return {
    status: mapped,
    deliveryConfirmed: mapped === 'delivered' || mapped === 'read',
  };
}

export function classifyProviderFailure(input: {
  errorCode?: string | null;
  message?: string | null;
}): { permanent: boolean; code: string } {
  const code = input.errorCode?.trim() || 'provider_error';
  if (code === 'provider_not_configured' || code === 'consent_blocked' || code === 'invalid_recipient') {
    return { permanent: true, code };
  }
  if (PERMANENT_SMS.has(code)) return { permanent: true, code };
  const text = `${code} ${input.message ?? ''}`.toLowerCase();
  if (/not configured|invalid|unsubscribed|opted out|blacklist|rejected/.test(text)) {
    return { permanent: true, code };
  }
  return { permanent: false, code };
}

export function canRetry(input: {
  status: DeliveryStatus;
  permanent: boolean;
  attemptCount: number;
  maxAttempts?: number;
}): { ok: true } | { ok: false; reason: string } {
  const max = input.maxAttempts ?? LIMITS.maxAttempts;
  if (input.permanent) return { ok: false, reason: 'permanent_failure' };
  if (input.attemptCount >= max) return { ok: false, reason: 'retry_limit' };
  if (input.status !== 'failed' && input.status !== 'pending') {
    return { ok: false, reason: 'not_retryable' };
  }
  return { ok: true };
}

export function planOutbound(input: {
  consentAllowed: boolean;
  requiresApproval: boolean;
  approvalGranted: boolean;
  redisAvailable: boolean;
}): { action: 'block' | 'await_approval' | 'queue' | 'send_inline' } {
  if (!input.consentAllowed) return { action: 'block' };
  if (input.requiresApproval && !input.approvalGranted) return { action: 'await_approval' };
  if (input.redisAvailable) return { action: 'queue' };
  return { action: 'send_inline' };
}

const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['scheduled', 'running', 'cancelled'],
  scheduled: ['running', 'paused', 'cancelled'],
  running: ['paused', 'completed', 'cancelled', 'failed'],
  paused: ['running', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: [],
};

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from].includes(to);
}

export function hourInTimeZone(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = parts.find((part) => part.type === 'hour')?.value;
    if (hour === undefined) return null;
    const parsed = Number(hour);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
  } catch {
    return null;
  }
}

export function isQuietHour(input: {
  now: Date;
  startHour: number | null;
  endHour: number | null;
  timeZone: string;
}): { quiet: boolean; known: boolean } {
  if (input.startHour === null || input.endHour === null) return { quiet: false, known: true };
  if (input.startHour === input.endHour) return { quiet: false, known: true };
  const hour = hourInTimeZone(input.now, input.timeZone);
  if (hour === null) return { quiet: false, known: false };
  if (input.startHour < input.endHour) {
    return { quiet: hour >= input.startHour && hour < input.endHour, known: true };
  }
  return { quiet: hour >= input.startHour || hour < input.endHour, known: true };
}

export function evaluateFollowUp(input: {
  purpose: Purpose;
  consent: ConsentDecision;
  conversationResolved: boolean;
  conditionStillTrue: boolean;
  duplicate: boolean;
  optedOut: boolean;
  priorFollowUps: number;
  maxFollowUps: number;
  delayMinutes: number | null;
  quiet: { quiet: boolean; known: boolean };
}): { proceed: boolean; reason: string } {
  if (!input.conditionStillTrue) return { proceed: false, reason: 'condition_false' };
  if (input.conversationResolved) return { proceed: false, reason: 'conversation_resolved' };
  if (input.optedOut || !input.consent.allowed) return { proceed: false, reason: input.consent.reason };
  if (input.duplicate) return { proceed: false, reason: 'duplicate_follow_up' };
  if (input.priorFollowUps >= input.maxFollowUps) return { proceed: false, reason: 'follow_up_limit' };
  if (input.delayMinutes === null || input.delayMinutes < 1) {
    return { proceed: false, reason: 'delay_not_configured' };
  }
  if (!input.quiet.known) return { proceed: false, reason: 'quiet_hours_unknown' };
  if (input.quiet.quiet && input.purpose !== 'transactional') {
    return { proceed: false, reason: 'quiet_hours' };
  }
  return { proceed: true, reason: 'eligible' };
}

export type VerifiedFacts = {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  preferredChannel?: string | null;
  channelPreferenceKnown?: boolean;
  excerpt?: string | null;
};

export type ReplyAnalysis = {
  intent: string;
  confidence: 'high' | 'medium' | 'insufficient';
  evidence: string | null;
  objection: string | null;
  opportunity: string | null;
  unanswered: boolean;
};

const INTENT_RULES: Array<{ intent: string; pattern: RegExp; confidence: 'high' | 'medium' }> = [
  { intent: 'opt_out', pattern: /\b(stop|unsubscribe|opt out)\b/i, confidence: 'high' },
  { intent: 'human_assistance', pattern: /\b(speak to|talk to|human|person|agent|call me)\b/i, confidence: 'high' },
  { intent: 'pricing_question', pattern: /\b(price|pricing|cost|quote|discount)\b/i, confidence: 'medium' },
  { intent: 'objection', pattern: /\b(too expensive|not interested|no thanks|don't need|do not need)\b/i, confidence: 'high' },
  { intent: 'opportunity', pattern: /\b(ready to|want to proceed|send (a )?proposal|let's move|lets move)\b/i, confidence: 'medium' },
];

export function analyzeReply(text: string): ReplyAnalysis {
  const source = text?.slice(0, 2000) ?? '';
  for (const rule of INTENT_RULES) {
    const match = source.match(rule.pattern);
    if (!match) continue;
    return {
      intent: rule.intent,
      confidence: rule.confidence,
      evidence: match[0],
      objection: rule.intent === 'objection' ? match[0] : null,
      opportunity: rule.intent === 'opportunity' ? match[0] : null,
      unanswered: source.includes('?'),
    };
  }
  return {
    intent: 'unknown',
    confidence: 'insufficient',
    evidence: null,
    objection: null,
    opportunity: null,
    unanswered: source.includes('?'),
  };
}

function factText(facts: VerifiedFacts): string {
  return [facts.firstName, facts.lastName, facts.companyName, facts.jobTitle, facts.excerpt]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n');
}

export function containsUnverifiedCommercialClaim(text: string, facts: VerifiedFacts): boolean {
  const allowed = factText(facts).toLowerCase();
  return COMMERCIAL.some((pattern) => {
    const match = text.match(pattern);
    if (!match) return false;
    return !allowed.includes(match[0].toLowerCase());
  });
}

export function draftFromFacts(input: {
  channel: Channel;
  facts: VerifiedFacts;
  purpose: Purpose;
}): { body: string; subject: string | null; authorKind: 'ai'; source: 'rules'; channelReason: string } {
  const name = input.facts.firstName?.trim();
  const greeting = name ? `Hello ${name},` : 'Hello,';
  const company = input.facts.companyName?.trim();
  const context = company ? ` regarding ${company}` : '';
  const excerpt = input.facts.excerpt?.trim();
  const reply = excerpt
    ? 'We received your message and a teammate will reply using only the details already on file.'
    : 'A teammate can follow up using the contact details already on file.';
  const body = [greeting, '', `${reply}${context}.`, '', 'This draft was prepared by AI and is not a sent message.'].join('\n');
  let channelReason = 'No stored channel preference was found, so this does not assume consent.';
  if (input.facts.channelPreferenceKnown && input.facts.preferredChannel) {
    channelReason = `Stored preference names ${input.facts.preferredChannel}. That is not proof of marketing consent.`;
  }
  return {
    body,
    subject: input.channel === 'email' ? `Follow-up${company ? ` for ${company}` : ''}` : null,
    authorKind: 'ai',
    source: 'rules',
    channelReason,
  };
}

export function acceptDraftText(text: string, facts: VerifiedFacts): { ok: true; text: string } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > LIMITS.emailBody) return { ok: false, reason: 'draft_invalid' };
  if (containsUnverifiedCommercialClaim(trimmed, facts)) return { ok: false, reason: 'unverified_commercial_claim' };
  return { ok: true, text: trimmed };
}

export type NormalizedInbound = {
  eventId: string;
  channel: Channel;
  direction: 'inbound';
  from: string;
  to: string;
  body: string;
  provider: 'twilio' | 'meta_cloud';
  providerMessageId: string;
  kind: 'message' | 'status';
  providerStatus?: string;
  errorCode?: string | null;
};

export function normalizeTwilioInbound(body: Record<string, string>): NormalizedInbound | null {
  const sid = body.MessageSid || body.SmsSid;
  const from = body.From ? normalizePhone(body.From) : null;
  const to = body.To ? normalizePhone(body.To) : null;
  if (!sid || !from || !to) return null;
  return {
    eventId: sid,
    channel: 'sms',
    direction: 'inbound',
    from,
    to,
    body: (body.Body ?? '').slice(0, LIMITS.smsBody),
    provider: 'twilio',
    providerMessageId: sid,
    kind: 'message',
  };
}

export function normalizeTwilioStatus(body: Record<string, string>): NormalizedInbound | null {
  const sid = body.MessageSid;
  if (!sid || !body.MessageStatus) return null;
  return {
    eventId: `status:${sid}:${body.MessageStatus}`,
    channel: 'sms',
    direction: 'inbound',
    from: body.From ?? '',
    to: body.To ?? '',
    body: '',
    provider: 'twilio',
    providerMessageId: sid,
    kind: 'status',
    providerStatus: body.MessageStatus,
    errorCode: body.ErrorCode || null,
  };
}

type WhatsAppEnvelope = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }>;
        statuses?: Array<{ id?: string; status?: string; recipient_id?: string; errors?: Array<{ code?: number }> }>;
      };
    }>;
  }>;
};

export function normalizeWhatsAppWebhook(payload: unknown): NormalizedInbound[] {
  const root = payload as WhatsAppEnvelope;
  const events: NormalizedInbound[] = [];
  for (const entry of root?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const business = value?.metadata?.display_phone_number ?? value?.metadata?.phone_number_id ?? '';
      for (const message of value?.messages ?? []) {
        if (!message.id || !message.from) continue;
        const from = normalizePhone(message.from.startsWith('+') ? message.from : `+${message.from}`);
        const to = business ? normalizePhone(business.startsWith('+') ? business : `+${business}`) : null;
        if (!from) continue;
        events.push({
          eventId: message.id,
          channel: 'whatsapp',
          direction: 'inbound',
          from,
          to: to ?? business,
          body: (message.text?.body ?? '').slice(0, LIMITS.whatsappBody),
          provider: 'meta_cloud',
          providerMessageId: message.id,
          kind: 'message',
        });
      }
      for (const status of value?.statuses ?? []) {
        if (!status.id || !status.status) continue;
        events.push({
          eventId: `status:${status.id}:${status.status}`,
          channel: 'whatsapp',
          direction: 'inbound',
          from: '',
          to: business,
          body: '',
          provider: 'meta_cloud',
          providerMessageId: status.id,
          kind: 'status',
          providerStatus: status.status,
          errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
        });
      }
    }
  }
  return events;
}

export type MetricCounts = {
  pending: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  cancelled: number;
  pendingApproval: number;
  inbound: number;
  outbound: number;
  byChannel: Record<string, number>;
  insufficientForResponseRate: true;
  responseTime: { sampleSize: number; medianMinutes: number | null; insufficient: boolean };
};

export function summarizeDeliveries(rows: Array<{
  status: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  createdAt?: Date | null;
  conversationId?: string | null;
}>): MetricCounts {
  const counts: MetricCounts = {
    pending: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    cancelled: 0,
    pendingApproval: 0,
    inbound: 0,
    outbound: 0,
    byChannel: {},
    insufficientForResponseRate: true,
    responseTime: { sampleSize: 0, medianMinutes: null, insufficient: true },
  };
  const outboundAt = new Map<string, Date>();
  const samples: number[] = [];
  for (const row of rows) {
    counts.byChannel[row.channel] = (counts.byChannel[row.channel] ?? 0) + 1;
    if (row.direction === 'inbound') counts.inbound += 1;
    else counts.outbound += 1;
    if (row.status === 'pending') counts.pending += 1;
    else if (row.status === 'pending_approval') counts.pendingApproval += 1;
    else if (row.status === 'queued') counts.queued += 1;
    else if (row.status === 'sending') counts.sending += 1;
    else if (row.status === 'sent') counts.sent += 1;
    else if (row.status === 'delivered') counts.delivered += 1;
    else if (row.status === 'read') counts.read += 1;
    else if (row.status === 'failed') counts.failed += 1;
    else if (row.status === 'cancelled') counts.cancelled += 1;
    if (row.conversationId && row.createdAt && row.direction === 'outbound') {
      const previous = outboundAt.get(row.conversationId);
      if (!previous || row.createdAt < previous) outboundAt.set(row.conversationId, row.createdAt);
    }
  }
  for (const row of rows) {
    if (row.direction !== 'inbound' || !row.conversationId || !row.createdAt) continue;
    const sentAt = outboundAt.get(row.conversationId);
    if (!sentAt || row.createdAt <= sentAt) continue;
    samples.push((row.createdAt.getTime() - sentAt.getTime()) / 60000);
  }
  samples.sort((a, b) => a - b);
  const median = samples.length
    ? samples[Math.floor((samples.length - 1) / 2)]
    : null;
  counts.responseTime = {
    sampleSize: samples.length,
    medianMinutes: median === null ? null : Math.round(median * 10) / 10,
    insufficient: samples.length === 0,
  };
  return counts;
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((stamp) => now - stamp < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
