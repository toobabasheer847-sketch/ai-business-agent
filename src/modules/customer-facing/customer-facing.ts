import { createHash, randomBytes } from 'node:crypto';

export const CUSTOMER_CHANNEL = 'customer_ai';
export const LEAD_SOURCE = 'customer-facing-ai';
export const SESSION_DAYS = 7;
export const MAX_MESSAGE_LENGTH = 2000;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const INTENTS = [
  'product_inquiry',
  'pricing_inquiry',
  'general_inquiry',
  'support_request',
  'sales_inquiry',
  'purchase_intent',
  'meeting_request',
  'complaint',
  'human_assistance',
  'unresolved',
  'other',
] as const;

export type CustomerIntent = (typeof INTENTS)[number];

const INJECTION =
  /\b(?:ignore (?:all |any |the )?(?:previous|prior|above)|system prompt|developer message|api[_ ]?key|secret key|other tenants?|employee (?:list|names|directory)|internal notes?|strategic plan|password|jwt|authorization header)\b/i;

export function generatePublicToken() {
  return randomBytes(32).toString('base64url');
}

export function generatePublicKey() {
  return randomBytes(16).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedSessionToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

export function isWellFormedPublicKey(value: string) {
  return PUBLIC_KEY_PATTERN.test(value);
}

export function sessionExpiry(now = new Date()) {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export function sessionUsable(row: { expiresAt: Date; endedAt: Date | null }, now = new Date()) {
  return !row.endedAt && row.expiresAt.getTime() > now.getTime();
}

export function assertMessageText(value: unknown) {
  if (typeof value !== 'string') return 'A message is required.';
  const text = value.trim();
  if (!text) return 'A message is required.';
  if (text.length > MAX_MESSAGE_LENGTH) return `A message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`;
  return null;
}

export function isPromptInjection(text: string) {
  return INJECTION.test(text);
}

export function classifyIntent(text: string): {
  intent: CustomerIntent;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string;
} {
  const value = text.trim();
  if (/\b(?:human|person|agent|representative|someone)\b/i.test(value) && /\b(?:talk|speak|connect|transfer|real)\b/i.test(value)) {
    return { intent: 'human_assistance', confidence: 'HIGH', evidence: 'The visitor asked to speak with a person.' };
  }
  if (/\b(?:complaint|unhappy|terrible|refund|angry)\b/i.test(value)) {
    return { intent: 'complaint', confidence: 'MEDIUM', evidence: 'The message uses complaint language. This is not a confirmed case.' };
  }
  if (/\b(?:price|pricing|cost|quote|how much)\b/i.test(value)) {
    return { intent: 'pricing_inquiry', confidence: 'MEDIUM', evidence: 'The message asks about price. No price was inferred.' };
  }
  if (/\b(?:buy|purchase|order|sign up|subscribe)\b/i.test(value)) {
    return { intent: 'purchase_intent', confidence: 'MEDIUM', evidence: 'The message mentions buying. It is not a completed purchase.' };
  }
  if (/\b(?:meeting|appointment|schedule|book a call|demo)\b/i.test(value)) {
    return { intent: 'meeting_request', confidence: 'MEDIUM', evidence: 'The message asks about a meeting or appointment.' };
  }
  if (/\b(?:support|broken|not working|help with|issue)\b/i.test(value)) {
    return { intent: 'support_request', confidence: 'MEDIUM', evidence: 'The message describes a support need.' };
  }
  if (/\b(?:product|service|offer|plan|package)\b/i.test(value)) {
    return { intent: 'product_inquiry', confidence: 'MEDIUM', evidence: 'The message asks about a product or service without naming a catalog.' };
  }
  if (/\b(?:sales|proposal|partnership)\b/i.test(value)) {
    return { intent: 'sales_inquiry', confidence: 'LOW', evidence: 'The message mentions sales. Interest is not confirmed.' };
  }
  if (value.includes('?')) {
    return { intent: 'general_inquiry', confidence: 'LOW', evidence: 'The message is a question that does not match a more specific pattern.' };
  }
  return { intent: 'other', confidence: 'LOW', evidence: 'No specific intent pattern matched.' };
}

export function needsHuman(intent: CustomerIntent, unanswered: boolean) {
  return intent === 'human_assistance' || intent === 'complaint' || unanswered;
}

export function handoffReason(intent: CustomerIntent, unanswered: boolean) {
  if (intent === 'human_assistance') return 'The visitor asked for a person.';
  if (intent === 'complaint') return 'The message uses complaint language.';
  if (unanswered) return 'The published information did not answer the question.';
  return null;
}

export type KnowledgeExcerpt = { title: string; text: string };

export function excerptsFromChunks(chunks: Array<{ documentTitle?: string; content?: string; text?: string }>): KnowledgeExcerpt[] {
  return chunks
    .map((chunk) => ({
      title: (chunk.documentTitle || 'Published document').slice(0, 120),
      text: (chunk.content || chunk.text || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    }))
    .filter((chunk) => chunk.text.length > 0)
    .slice(0, 2);
}

export function groundedAnswer(question: string, excerpts: KnowledgeExcerpt[]) {
  if (isPromptInjection(question)) {
    return {
      text: 'I can only answer from this business’s published information. I can’t share internal instructions or private records.',
      unanswered: true,
      cited: [] as string[],
    };
  }
  const pricing = /\b(?:price|pricing|cost|quote|how much)\b/i.test(question);
  const priced = excerpts.some((item) => /(?:\$|£|€|\bprice\b|\bcost\b|\bper\b)/i.test(item.text));
  if (!excerpts.length) {
    return {
      text: 'I don’t have published information that answers that. I have not guessed a price, policy, or availability.',
      unanswered: true,
      cited: [] as string[],
    };
  }
  if (pricing && !priced) {
    return {
      text: 'The published information I found does not include a price. I have not invented one.',
      unanswered: true,
      cited: excerpts.map((item) => item.title),
    };
  }
  const body = excerpts.map((item) => `${item.title}: ${item.text}`).join('\n');
  return {
    text: `Here is what the published information says:\n${body}`,
    unanswered: false,
    cited: excerpts.map((item) => item.title),
  };
}

export function acceptGroundedRewrite(source: string, modelText: string | null) {
  if (!modelText?.trim()) return null;
  const extraNumber = modelText.match(/\d[\d,.]*/g)?.find((value) => !source.includes(value));
  if (extraNumber) return null;
  if (/\b(?:i promise|guaranteed|definitely available|we will)\b/i.test(modelText) && !/\b(?:i promise|guaranteed|definitely available|we will)\b/i.test(source)) {
    return null;
  }
  return modelText.trim().slice(0, 2000);
}

export function leadReadiness(input: {
  captureEnabled: boolean;
  companyId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}) {
  if (!input.captureEnabled) return { ready: false, reason: 'Automatic lead capture is turned off.' };
  if (!input.companyId) return { ready: false, reason: 'No company is configured, so a lead was not created.' };
  if (!input.name?.trim()) return { ready: false, reason: 'A name was not provided.' };
  if (!input.email?.trim() && !input.phone?.trim()) return { ready: false, reason: 'An email or phone number was not provided.' };
  return { ready: true, reason: 'The visitor provided a name and a contact method.' };
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0]?.slice(0, 100) ?? '', lastName: parts.slice(1).join(' ').slice(0, 100) || null };
}

export function sameContact(left: string | null, right: string | null) {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function summarizeMessages(messages: Array<{ role: string; content: string }>) {
  const customer = messages.filter((item) => item.role === 'human').map((item) => item.content.trim()).filter(Boolean);
  const answers = messages.filter((item) => item.role === 'ai').map((item) => item.content.trim());
  const questions = customer.filter((item) => item.includes('?'));
  const unanswered = answers.filter((item) => /don’t have published|does not include a price|have not guessed|can only answer/i.test(item));
  return {
    purpose: customer[0]?.slice(0, 280) ?? 'No customer message is stored.',
    requirements: customer.slice(1, 4).join(' ').slice(0, 500),
    questions,
    unanswered,
    humanNeeded: unanswered.length > 0,
    text: [
      `Purpose: ${customer[0]?.slice(0, 280) ?? 'No customer message is stored.'}`,
      questions.length ? `Questions: ${questions.slice(0, 5).join(' | ')}` : 'Questions: none marked with a question mark.',
      unanswered.length ? `Unanswered: ${unanswered.length} reply${unanswered.length === 1 ? '' : 's'} said the published information was insufficient.` : 'Unanswered: none of the stored replies reported missing information.',
      'This summary uses the stored messages only. It does not add a commitment.',
    ].join('\n'),
  };
}

const ACCENTS = new Set(['slate', 'blue', 'emerald']);

export function publicAccent(value: string | null | undefined) {
  return value && ACCENTS.has(value) ? value : 'slate';
}

export function publicView(settings: {
  displayName: string;
  welcomeMessage: string;
  enabled: boolean;
  collectName: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  accent?: string | null;
}) {
  return {
    displayName: settings.displayName,
    welcomeMessage: settings.welcomeMessage,
    enabled: settings.enabled,
    collectName: settings.collectName,
    collectEmail: settings.collectEmail,
    collectPhone: settings.collectPhone,
    accent: publicAccent(settings.accent),
    disclosure: 'You are talking with an AI assistant. A person has not joined unless the team says so in this chat.',
    privacyNotice: 'Messages are stored for this business so the team can continue the conversation. Share contact details only if you want a follow-up.',
    starters: ['What services do you offer?', 'How can someone contact you?', 'I would like to speak with a person.'],
  };
}

export function customerRateKey(ip: string) {
  return `customer-chat:${ip || 'unknown'}`;
}
