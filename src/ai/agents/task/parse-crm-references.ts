import { stripDueDatePhrases } from './parse-task-datetime.js';

export interface CrmReferences {
  companyQuery?: string;
  personQuery?: string;
  emailQuery?: string;
  explicitCompany: boolean;
}

const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

const REFERENCE_STOP = new Set([
  'a',
  'an',
  'the',
  'my',
  'me',
  'to',
  'for',
  'with',
  'from',
  'about',
  'task',
  'tasks',
  'priority',
  'high',
  'low',
  'medium',
  'urgent',
  'today',
  'tomorrow',
  'week',
  'weeks',
  'month',
  'months',
  'year',
  'years',
  'last',
  'yesterday',
  'days',
  'day',
  'report',
  'performance',
  'statistics',
  'stats',
  'analytics',
  'trend',
  'trends',
  'next',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'please',
  'new',
  'create',
  'remind',
  'follow',
  'up',
  'call',
  'contact',
  'email',
  'this',
  'related',
  'company',
  'prospect',
  'lead',
]);

export function extractCrmReferences(text: string): CrmReferences {
  const cleaned = stripDueDatePhrases(text)
    .replace(/\band\s+remind\s+me(?:\s+at)?\b/gi, ' ')
    .replace(/\bremind\s+me(?:\s+to)?\b/gi, ' ')
    .replace(/[.,!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const emailQuery = cleaned.match(EMAIL_RE)?.[0];

  const fromMatch = cleaned.match(
    /\b([A-Za-z][A-Za-z'-]{1,40}(?:\s+[A-Za-z][A-Za-z'-]{1,40})?)\s+from\s+([A-Za-z0-9][A-Za-z0-9 .&'-]{0,60}?)(?:\s+company)?(?=\s|$)/i,
  );

  const explicitCompanyMatch =
    cleaned.match(
      /\b(?:with|for|at)\s+([A-Za-z0-9][A-Za-z0-9 .&'-]{0,60}?)\s+company\b/i,
    ) ||
    cleaned.match(/\b([A-Za-z0-9][A-Za-z0-9 .&'-]{0,60}?)\s+company\b/i) ||
    cleaned.match(/\bcompany\s+([A-Za-z0-9][A-Za-z0-9 .&'-]{0,60}?)(?=\s|$)/i);

  const relatedMatch = cleaned.match(
    /\b(?:tasks?|task)\s+(?:for|related to|about)\s+(?!this\s+company\b)([A-Za-z0-9][A-Za-z0-9 .&'-]{0,60}?)(?=\s|$)/i,
  );
  const relatedToMatch = cleaned.match(
    /\brelated to\s+(?!this\s+company\b)([A-Za-z0-9][A-Za-z0-9 .&'-]{0,60}?)(?=\s|$)/i,
  );

  const forCreateMatch =
    !fromMatch &&
    cleaned.match(
      /\bfor\s+(?!this\s+company\b)([A-Za-z][A-Za-z0-9 .&'-]{0,40}?)(?:\s+to\b|\s+tomorrow\b|\s+today\b|$)/i,
    );

  const companyQuery = sanitizeQuery(
    fromMatch?.[2] || explicitCompanyMatch?.[1],
  );

  let personQuery: string | undefined;
  if (fromMatch?.[1]) {
    personQuery = sanitizeQuery(fromMatch[1]);
  } else if (!emailQuery) {
    const personMatch = cleaned.match(
      /\b(?:follow(?:\s|-)?up with|contact|call|email)\s+([A-Za-z][A-Za-z'-]{1,40}(?:\s+[A-Za-z][A-Za-z'-]{1,40})?)\b/i,
    );
    personQuery = sanitizeQuery(personMatch?.[1]);
  }

  if (!personQuery && !emailQuery) {
    const relatedOrFor = sanitizeQuery(
      relatedMatch?.[1] || relatedToMatch?.[1] || forCreateMatch?.[1],
    );
    if (
      relatedOrFor &&
      relatedOrFor.toLowerCase() !== (companyQuery || '').toLowerCase()
    ) {
      personQuery = relatedOrFor;
    } else if (relatedOrFor && !companyQuery) {
      personQuery = relatedOrFor;
    }
  }

  if (personQuery && companyQuery && personQuery.toLowerCase() === companyQuery.toLowerCase()) {
    personQuery = undefined;
  }

  return {
    companyQuery,
    personQuery,
    emailQuery,
    explicitCompany: Boolean(explicitCompanyMatch),
  };
}

function sanitizeQuery(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = value.replace(/[.,!?]+$/g, '').replace(/\s+/g, ' ').trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token && !REFERENCE_STOP.has(token.toLowerCase()));
  const normalized = tokens.join(' ').trim();
  if (!normalized) {
    return undefined;
  }

  return normalized;
}
