import { extractCrmReferences } from './parse-crm-references.js';
import {
  parseTaskDueAt,
  stripDueDatePhrases,
} from './parse-task-datetime.js';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskPriority,
  TaskStatus,
} from './types/task.types.js';

export type TaskNlAction =
  | 'create'
  | 'list'
  | 'get'
  | 'complete'
  | 'cancel'
  | 'update'
  | 'clarify';

export interface TaskNlCommand {
  action: TaskNlAction;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueAt?: string;
  taskId?: string;
  searchTerm?: string;
  dueOn?: 'today' | 'tomorrow' | 'overdue' | 'upcoming';
  message?: string;
  companyQuery?: string;
  personQuery?: string;
  emailQuery?: string;
  explicitCompany?: boolean;
}

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const SECURITY_PHRASE_RE =
  /\b(?:tenantid|createdby)\s*[:=]?\s*\S+|\bfor\s+tenant\s+\S+|\bcreated\s+by\s+\S+|\bin\s+tenant[-\s]?\S+/gi;

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'me',
  'please',
  'task',
  'tasks',
  'to',
  'for',
  'as',
  'is',
  'be',
  'with',
]);

export interface ParseTaskCommandOptions {
  now?: Date;
}

export function parseTaskCommand(
  raw: string,
  options: ParseTaskCommandOptions = {},
): TaskNlCommand {
  const now = options.now ?? new Date();
  const original = raw.trim().replace(/[.,!?]+$/, '');

  if (!original) {
    return {
      action: 'clarify',
      message: 'Please tell me what you would like to do with your tasks.',
    };
  }

  const text = stripSecurityPhrases(original);
  const lower = text.toLowerCase();
  let command: TaskNlCommand;

  if (isCreateIntent(lower)) {
    command = parseCreate(text, now);
  } else if (isCompleteIntent(lower)) {
    command = parseTargetedAction(text, 'complete', [
      'complete',
      'completed',
      'mark',
      'done',
    ]);
  } else if (isCancelIntent(lower)) {
    command = parseTargetedAction(text, 'cancel', ['cancel', 'cancelled']);
  } else {
    const priorityUpdate = parsePriorityUpdate(text);
    if (priorityUpdate) {
      command = priorityUpdate;
    } else {
      const statusUpdate = parseStatusUpdate(text);
      if (statusUpdate) {
        command = statusUpdate;
      } else if (isListIntent(lower)) {
        command = parseList(lower);
      } else if (isGetIntent(lower)) {
        command = parseTargetedAction(text, 'get', [
          'show',
          'get',
          'find',
          'display',
        ]);
      } else {
        command = {
          action: 'clarify',
          message:
            'I could not understand that task request. Try “Create a task to call Ahmed tomorrow” or “Show my pending tasks.”',
        };
      }
    }
  }

  return attachCrmReferences(command, text);
}

function attachCrmReferences(
  command: TaskNlCommand,
  text: string,
): TaskNlCommand {
  if (command.action === 'clarify') {
    return command;
  }

  const refs = extractCrmReferences(text);
  return {
    ...command,
    companyQuery: refs.companyQuery,
    personQuery: refs.personQuery,
    emailQuery: refs.emailQuery,
    explicitCompany: refs.explicitCompany,
  };
}

export function titleMatchesSearch(title: string, searchTerm: string): boolean {
  const haystack = normalize(title);
  const needle = normalize(searchTerm);

  if (!needle || !haystack) {
    return false;
  }

  if (haystack.includes(needle)) {
    return true;
  }

  const tokens = tokenize(needle).filter((token) => !STOP_WORDS.has(token));
  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => haystack.includes(token));
}

function parseCreate(text: string, now: Date): TaskNlCommand {
  const due = parseTaskDueAt(text, now);
  if (due.status === 'invalid') {
    return { action: 'clarify', message: due.message };
  }

  const priorityResult = extractPriority(text);
  if (priorityResult.invalid) {
    return {
      action: 'clarify',
      message: `"${priorityResult.invalid}" is not a valid priority. Use low, medium, high, or urgent.`,
    };
  }

  let remainder = stripDueDatePhrases(stripSecurityPhrases(text));
  remainder = remainder.replace(/\b(low|medium|high|urgent)\s+priority\b/gi, ' ');
  remainder = remainder.replace(/\bpriority\s*[:\s]\s*(low|medium|high|urgent)\b/gi, ' ');
  remainder = remainder.replace(
    /^\s*(?:please\s+)?(?:create|add|new)(?:\s+a|\s+an)?(?:\s+task)?(?:\s*:)?(?:\s+to)?\s*/i,
    '',
  );
  remainder = remainder.replace(
    /^\s*(?:please\s+)?remind\s+me(?:\s+to)?\s*/i,
    '',
  );
  remainder = remainder.replace(/\band\s+remind\s+me(?:\s+at)?\b/gi, ' ');
  remainder = remainder.replace(/\s+/g, ' ').trim().replace(/[.,!?]+$/, '');

  const title = capitalizeFirst(remainder);
  if (title.length < 3) {
    return {
      action: 'clarify',
      message: 'What should I name the task?',
    };
  }

  return {
    action: 'create',
    title: title.slice(0, 255),
    priority: priorityResult.priority ?? 'medium',
    dueAt: due.status === 'ok' ? due.dueAt.toISOString() : undefined,
  };
}

function parseList(lower: string): TaskNlCommand {
  const status = extractStatus(lower);
  const priority = extractPriority(lower);

  if (priority.invalid) {
    return {
      action: 'clarify',
      message: `"${priority.invalid}" is not a valid priority. Use low, medium, high, or urgent.`,
    };
  }

  return {
    action: 'list',
    status,
    priority: priority.priority,
    dueOn: parseDueOn(lower),
  };
}

function parsePriorityUpdate(text: string): TaskNlCommand | null {
  const lower = text.toLowerCase();
  if (
    !/\bpriority\b/.test(lower) &&
    !/\bset\b.+\bto\s+\w+/.test(lower) &&
    !/\bmake\b.+\bpriority\b/.test(lower)
  ) {
    return null;
  }

  if (/\b(move|set|change)\b.+\bto\s+in\s*progress\b/.test(lower)) {
    return null;
  }

  if (
    /\bto\s+(pending|completed|cancelled|in_progress|in\s+progress)\b/.test(lower) &&
    !/\bpriority\b/.test(lower)
  ) {
    return null;
  }

  const explicit = lower.match(
    /\bpriority\s+to\s+(\w+)|\bto\s+(\w+)\s+priority\b|\bmake\b.+\b(\w+)\s+priority\b|\bto\s+(low|medium|high|urgent)\b/,
  );
  const value = (explicit?.[1] || explicit?.[2] || explicit?.[3] || explicit?.[4] || '')
    .toLowerCase();

  if (!value) {
    return null;
  }

  if (!isPriority(value)) {
    return {
      action: 'clarify',
      message: `"${value}" is not a valid priority. Use low, medium, high, or urgent.`,
    };
  }

  return {
    action: 'update',
    priority: value,
    ...extractTarget(text, [
      'change',
      'set',
      'make',
      'priority',
      'to',
      value,
      'low',
      'medium',
      'high',
      'urgent',
    ]),
  };
}

function parseStatusUpdate(text: string): TaskNlCommand | null {
  const lower = text.toLowerCase();
  if (!/\b(move|set|change|mark)\b/.test(lower) || !/\bto\b/.test(lower)) {
    return null;
  }

  const status = extractStatus(lower);
  if (!status) {
    const invalid = lower.match(/\bto\s+([a-z_ ]+?)\s*$/);
    const value = invalid?.[1]?.trim().replace(/[.,!?]+$/, '');
    if (value) {
      return {
        action: 'clarify',
        message: `"${value}" is not a valid status. Use pending, in_progress, completed, or cancelled.`,
      };
    }
    return null;
  }

  return {
    action: 'update',
    status,
    ...extractTarget(text, [
      'move',
      'set',
      'change',
      'mark',
      'status',
      'to',
      'in',
      'progress',
      'in_progress',
      'pending',
      'completed',
      'cancelled',
    ]),
  };
}

function parseTargetedAction(
  text: string,
  action: 'get' | 'complete' | 'cancel',
  extraStops: string[],
): TaskNlCommand {
  return {
    action,
    ...extractTarget(text, extraStops),
  };
}

function extractTarget(
  text: string,
  extraStops: string[],
): { taskId?: string; searchTerm?: string } {
  const uuid = text.match(UUID_RE)?.[0];
  let remainder = stripDueDatePhrases(stripSecurityPhrases(text));
  remainder = remainder.replace(UUID_RE, ' ');
  remainder = remainder.replace(
    /\b(low|medium|high|urgent)\s+priority\b/gi,
    ' ',
  );

  const stops = new Set(
    [
      ...STOP_WORDS,
      ...extraStops,
      'show',
      'list',
      'get',
      'find',
      'display',
      'related',
      'about',
      'change',
      'set',
      'make',
      'move',
      'mark',
      'complete',
      'completed',
      'cancel',
      'cancelled',
      'priority',
      'status',
      'in',
      'progress',
      'pending',
    ].map((word) => word.toLowerCase()),
  );

  const tokens = remainder
    .replace(/[.,!?:"']/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !stops.has(token.toLowerCase()));

  const searchTerm = tokens.join(' ').trim();

  return {
    taskId: uuid,
    searchTerm: searchTerm || undefined,
  };
}

function extractPriority(text: string): {
  priority?: TaskPriority;
  invalid?: string;
} {
  const explicit = text.match(
    /\bpriority\s*(?:to|:|=)?\s*([a-z]+)\b|\b([a-z]+)\s+priority\b/i,
  );
  if (!explicit) {
    return {};
  }

  const value = (explicit[1] || explicit[2] || '').toLowerCase();
  if (!value) {
    return {};
  }

  if (!isPriority(value)) {
    return { invalid: value };
  }

  return { priority: value };
}

function extractStatus(text: string): TaskStatus | undefined {
  if (/\bin[\s_-]*progress\b/.test(text)) {
    return 'in_progress';
  }
  if (/\bcancelled\b/.test(text)) {
    return 'cancelled';
  }
  if (/\bcompleted\b/.test(text)) {
    return 'completed';
  }
  if (/\bpending\b/.test(text)) {
    return 'pending';
  }
  return undefined;
}

function parseDueOn(
  lower: string,
): 'today' | 'tomorrow' | 'overdue' | 'upcoming' | undefined {
  if (/\boverdue\b/.test(lower)) {
    return 'overdue';
  }
  if (/\bdue tomorrow\b|\btomorrow'?s tasks\b/.test(lower)) {
    return 'tomorrow';
  }
  if (/\bdue today\b|\bfor today\b|\btoday'?s tasks\b/.test(lower)) {
    return 'today';
  }
  if (/\bupcoming\b/.test(lower)) {
    return 'upcoming';
  }
  return undefined;
}

function isCreateIntent(lower: string): boolean {
  return (
    /^(?:please\s+)?(?:create|add|new)\b/.test(lower) ||
    /\bnew\s+task\b/.test(lower) ||
    /^(?:please\s+)?remind\s+me\b/.test(lower) ||
    /\bremind me to\b/.test(lower)
  );
}

function isCompleteIntent(lower: string): boolean {
  return (
    /\bmark\b.+\b(?:as\s+)?(?:completed|complete|done)\b/.test(lower) ||
    /^(?:please\s+)?complete\b/.test(lower)
  );
}

function isCancelIntent(lower: string): boolean {
  return /^(?:please\s+)?cancel\b/.test(lower) || /\bcancel\s+(?:my|the)\b/.test(lower);
}

function isListIntent(lower: string): boolean {
  if (/\btasks\b/.test(lower)) {
    return true;
  }

  return (
    /\b(show|list|display)\s+my\s+(pending|completed|cancelled|in[\s-]*progress|overdue)(?:\s+task)?$/.test(
      lower,
    ) ||
    /\b(show|list|display)\s+my\s+(high|low|medium|urgent)\s+priority(?:\s+task)?$/.test(
      lower,
    )
  );
}

function isGetIntent(lower: string): boolean {
  return /\b(show|get|find|display)\b/.test(lower) && /\btask\b/.test(lower);
}

function stripSecurityPhrases(text: string): string {
  return text.replace(SECURITY_PHRASE_RE, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function capitalizeFirst(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value);
}

export function isStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}
