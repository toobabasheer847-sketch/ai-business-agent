import { extractCrmReferences } from './parse-crm-references.js';
import {
  addUtcDays,
  endOfUtcDay,
  parseTaskDueAt,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
  stripDueDatePhrases,
} from './parse-task-datetime.js';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskNlAnalyticsFocus,
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
  | 'clarify'
  | 'activity'
  | 'analytics'
  | 'reminder_list'
  | 'reminder_enable'
  | 'reminder_disable'
  | 'reminder_reschedule'
  | 'add_dependency'
  | 'remove_dependency'
  | 'list_blocked';

export interface TaskNlCommand {
  action: TaskNlAction;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueAt?: string;
  taskId?: string;
  searchTerm?: string;
  dependencySearchTerm?: string;
  dueOn?: 'today' | 'tomorrow' | 'overdue' | 'upcoming';
  message?: string;
  companyQuery?: string;
  personQuery?: string;
  emailQuery?: string;
  explicitCompany?: boolean;
  from?: string;
  to?: string;
  rangeField?: 'createdAt' | 'completedAt';
  hasReminder?: boolean;
  focus?: TaskNlAnalyticsFocus;
  assigneeQuery?: string;
  recurrenceEnabled?: boolean;
  recurrenceInterval?: string;
  recurrenceEndsAt?: string;
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

  if (isDependencyIntent(lower)) {
    command = parseDependencyCommand(text);
  } else if (isBlockedListIntent(lower)) {
    command = { action: 'list_blocked' };
  } else if (isReminderManageIntent(lower)) {
    command = parseReminderCommand(text, now);
  } else if (isCreateIntent(lower)) {
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
      } else if (isAnalyticsIntent(lower)) {
        command = parseAnalytics(text, now);
      } else if (isActivityIntent(lower)) {
        command = parseTargetedAction(text, 'activity', [
          'show',
          'get',
          'display',
          'activity',
          'history',
          'the',
          'of',
        ]);
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

  const assigneeQuery = extractAssigneeQuery(text);
  const refs = extractCrmReferences(text);
  return {
    ...command,
    assigneeQuery,
    companyQuery: refs.companyQuery,
    personQuery: assigneeQuery ? undefined : refs.personQuery,
    emailQuery: refs.emailQuery,
    explicitCompany: refs.explicitCompany,
  };
}

function extractAssigneeQuery(text: string): string | undefined {
  const match = text.match(
    /\bassigned to\s+([A-Za-z][A-Za-z0-9 .'-]{0,60}?)(?=\s|$)/i,
  );
  const value = match?.[1]?.replace(/[.,!?]+$/g, '').trim();
  return value || undefined;
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
  remainder = remainder.replace(
    /\b(?:every\s+(?:day|week|month|monday)|daily|weekly|monthly)\b/gi,
    ' ',
  );
  remainder = remainder.replace(
    /\buntil\s+\d{4}-\d{2}-\d{2}|\bend(?:s)?\s+on\s+\d{4}-\d{2}-\d{2}/gi,
    ' ',
  );
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
    ...extractRecurrence(text, now, due.status === 'ok' ? due.dueAt.toISOString() : undefined),
  };
}

function extractRecurrence(
  text: string,
  now: Date,
  existingDueAt?: string,
): Pick<
  TaskNlCommand,
  'recurrenceEnabled' | 'recurrenceInterval' | 'recurrenceEndsAt' | 'dueAt'
> {
  const lower = text.toLowerCase();
  let interval: string | undefined;
  if (/\bevery\s+day\b|\bdaily\b/.test(lower)) {
    interval = 'daily';
  } else if (/\bevery\s+week\b|\bweekly\b|\bevery\s+monday\b/.test(lower)) {
    interval = 'weekly';
  } else if (/\bevery\s+month\b|\bmonthly\b/.test(lower)) {
    interval = 'monthly';
  }

  if (!interval) {
    return {};
  }

  const result: Pick<
    TaskNlCommand,
    'recurrenceEnabled' | 'recurrenceInterval' | 'recurrenceEndsAt' | 'dueAt'
  > = {
    recurrenceEnabled: true,
    recurrenceInterval: interval,
  };

  if (!existingDueAt && /\bevery\s+monday\b/.test(lower) && interval === 'weekly') {
    const monday = parseTaskDueAt('next Monday', now);
    if (monday.status === 'ok') {
      result.dueAt = monday.dueAt.toISOString();
    }
  }

  const until = lower.match(
    /\buntil\s+(\d{4}-\d{2}-\d{2})|\bend(?:s)?\s+on\s+(\d{4}-\d{2}-\d{2})/,
  );
  const endRaw = until?.[1] || until?.[2];
  if (endRaw) {
    const end = new Date(`${endRaw}T23:59:59.000Z`);
    if (!Number.isNaN(end.getTime())) {
      result.recurrenceEndsAt = end.toISOString();
    }
  }

  return result;
}

function isDependencyIntent(lower: string): boolean {
  return (
    (/\bdepend(?:s|ency|encies)?\b/.test(lower) ||
      /\bprerequisite\b/.test(lower) ||
      /\bblocked by\b/.test(lower)) &&
    !isBlockedListIntent(lower)
  );
}

function isBlockedListIntent(lower: string): boolean {
  return (
    /\bblocked tasks?\b/.test(lower) ||
    /\btasks? (?:that )?are blocked\b/.test(lower) ||
    /\bwhich tasks? are blocked\b/.test(lower) ||
    /\bwaiting for\b.+\b(?:to )?(?:finish|complete)\b/.test(lower)
  );
}

function parseDependencyCommand(text: string): TaskNlCommand {
  const lower = text.toLowerCase();
  const remove =
    /\b(remove|delete|unlink|clear)\b.+\bdepend/.test(lower) ||
    /\bremove the dependency\b/.test(lower);

  const makeMatch = text.match(
    /\bmake\s+(.+?)\s+depend(?:s)?\s+on\s+(.+?)$/i,
  );
  const dependsMatch = text.match(/^(.+?)\s+depends\s+on\s+(.+?)$/i);
  const betweenMatch = text.match(/\bbetween\s+(.+?)\s+and\s+(.+?)$/i);

  let searchTerm: string | undefined;
  let dependencySearchTerm: string | undefined;

  if (makeMatch) {
    searchTerm = makeMatch[1].trim().replace(/[.,!?]+$/, '');
    dependencySearchTerm = makeMatch[2].trim().replace(/[.,!?]+$/, '');
  } else if (dependsMatch) {
    searchTerm = dependsMatch[1]
      .replace(/^(?:please\s+)?(?:make\s+)?/i, '')
      .trim()
      .replace(/[.,!?]+$/, '');
    dependencySearchTerm = dependsMatch[2].trim().replace(/[.,!?]+$/, '');
  } else if (betweenMatch) {
    searchTerm = betweenMatch[1].trim().replace(/[.,!?]+$/, '');
    dependencySearchTerm = betweenMatch[2].trim().replace(/[.,!?]+$/, '');
  }

  if (!searchTerm || !dependencySearchTerm) {
    return {
      action: 'clarify',
      message:
        'Name both tasks, for example “Make Send proposal depend on Create proposal.”',
    };
  }

  return {
    action: remove ? 'remove_dependency' : 'add_dependency',
    searchTerm,
    dependencySearchTerm,
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
  action: 'get' | 'complete' | 'cancel' | 'activity' | 'reminder_list' | 'reminder_enable' | 'reminder_disable',
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
    /\bremind me to\b/.test(lower)
  );
}

function isReminderManageIntent(lower: string): boolean {
  if (/\bremind me to\b/.test(lower)) {
    return false;
  }
  return (
    /\b(disable|enable|turn off|turn on)\b.+\breminders?\b/.test(lower) ||
    /\breminders?\b.+\b(disable|enable|turn off|turn on)\b/.test(lower) ||
    /\bcancel\b.+\breminders?\b/.test(lower) ||
    /\breschedule\b.+\breminders?\b/.test(lower) ||
    /\bshow reminders\b|\breminders for\b/.test(lower) ||
    /\bdid\b.+\breminder\b.+\bsent\b/.test(lower) ||
    /\bwhy\b.+\breminder\b.+\bfail/.test(lower) ||
    /\bremind me about\b/.test(lower)
  );
}

function parseReminderCommand(text: string, now: Date): TaskNlCommand {
  const lower = text.toLowerCase();
  const extraStops = [
    'show',
    'get',
    'display',
    'the',
    'of',
    'reminder',
    'reminders',
    'remind',
    'enable',
    'disable',
    'turn',
    'off',
    'on',
    'reschedule',
    'about',
    'did',
    'get',
    'sent',
    'why',
    'fail',
    'failed',
  ];

  if (/\b(disable|turn off|cancel)\b/.test(lower) && /\breminders?\b/.test(lower)) {
    return parseTargetedAction(text, 'reminder_disable', extraStops);
  }
  if (/\breschedule\b/.test(lower)) {
    const due = parseTaskDueAt(text, now);
    const target = extractTarget(text, extraStops);
    if (due.status === 'invalid') {
      return { action: 'clarify', message: due.message, ...target };
    }
    if (due.status === 'none') {
      return {
        action: 'clarify',
        message:
          'When should I reschedule the reminder? Use a valid time such as 2 PM.',
        ...target,
      };
    }
    return {
      action: 'reminder_reschedule',
      dueAt: due.dueAt.toISOString(),
      ...target,
    };
  }
  if (/\b(enable|turn on|remind me about)\b/.test(lower)) {
    return parseTargetedAction(text, 'reminder_enable', extraStops);
  }
  if (
    /\bshow reminders\b|\blist reminders\b/.test(lower) ||
    /\bdid\b.+\breminder\b.+\bsent\b/.test(lower) ||
    /\bwhy\b.+\breminder\b.+\bfail/.test(lower) ||
    (/\breminders for\b/.test(lower) && !/\b(enable|disable|turn)\b/.test(lower))
  ) {
    return parseTargetedAction(text, 'reminder_list', extraStops);
  }

  return parseTargetedAction(text, 'reminder_enable', extraStops);
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

function parseAnalytics(text: string, now: Date): TaskNlCommand {
  const lower = text.toLowerCase();
  const range = parseAnalyticsRange(lower, now);
  const status = extractStatus(lower);
  const priority = extractPriority(lower);

  if (priority.invalid) {
    return {
      action: 'clarify',
      message: `"${priority.invalid}" is not a valid priority. Use low, medium, high, or urgent.`,
    };
  }

  let focus: TaskNlAnalyticsFocus = 'summary';
  if (/\b(report|performance)\b/.test(lower)) {
    focus = 'report';
  } else if (/\btrends?\b/.test(lower)) {
    focus = 'trends';
  } else if (/\bcompletion rate\b|\boverdue rate\b/.test(lower)) {
    focus = 'rate';
  } else if (/\boverdue\b/.test(lower)) {
    focus = 'overdue';
  } else if (/\bactivity\b/.test(lower)) {
    focus = 'activity';
  } else if (/\breminders?\b/.test(lower)) {
    focus = 'reminders';
  } else if (priority.priority) {
    focus = 'priority';
  } else if (status === 'completed' || /\b(?:did i |have i )?complete[d]?\b/.test(lower)) {
    focus = 'completed';
  }

  const completedRange = focus === 'completed' && Boolean(range.from);
  const needsDefaultRange =
    (focus === 'report' || focus === 'trends') && !range.from;

  return {
    action: 'analytics',
    status: completedRange ? 'completed' : status,
    priority: priority.priority,
    from: range.from ?? (needsDefaultRange ? addUtcDays(now, -29).toISOString() : undefined),
    to: range.to ?? (needsDefaultRange ? endOfUtcDay(now).toISOString() : undefined),
    rangeField: completedRange ? 'completedAt' : 'createdAt',
    hasReminder: focus === 'reminders' ? true : undefined,
    focus,
  };
}

function parseAnalyticsRange(
  lower: string,
  now: Date,
): { from?: string; to?: string } {
  if (/\btoday\b/.test(lower) && !/\byesterday\b/.test(lower) && !/\bthis week\b|\bthis month\b/.test(lower)) {
    if (/\bfor today\b|\btoday'?s\b|\btasks today\b/.test(lower)) {
      return {
        from: startOfUtcDay(now).toISOString(),
        to: endOfUtcDay(now).toISOString(),
      };
    }
  }
  if (/\byesterday\b/.test(lower)) {
    const yesterday = addUtcDays(now, -1);
    return {
      from: startOfUtcDay(yesterday).toISOString(),
      to: endOfUtcDay(yesterday).toISOString(),
    };
  }
  if (/\blast week\b/.test(lower)) {
    const thisWeek = startOfUtcWeek(now);
    return {
      from: addUtcDays(thisWeek, -7).toISOString(),
      to: new Date(thisWeek.getTime() - 1).toISOString(),
    };
  }
  if (/\bthis week\b/.test(lower)) {
    return {
      from: startOfUtcWeek(now).toISOString(),
      to: endOfUtcDay(now).toISOString(),
    };
  }
  if (/\blast month\b/.test(lower)) {
    const thisMonth = startOfUtcMonth(now);
    const lastMonthStart = new Date(
      Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1),
    );
    return {
      from: lastMonthStart.toISOString(),
      to: new Date(thisMonth.getTime() - 1).toISOString(),
    };
  }
  if (/\bthis month\b/.test(lower)) {
    return {
      from: startOfUtcMonth(now).toISOString(),
      to: endOfUtcDay(now).toISOString(),
    };
  }
  return {};
}

function isAnalyticsIntent(lower: string): boolean {
  if (
    /\b(how many|how much|statistics|stats|analytics|completion rate|overdue rate|report|performance|trends?)\b/.test(
      lower,
    )
  ) {
    return true;
  }

  if (
    /\b(this week|this month|last week|last month)\b/.test(lower) &&
    /\b(tasks?|activity)\b/.test(lower)
  ) {
    return true;
  }

  return /\btask (?:statistics|stats|analytics|activity|report|performance|trends?)\b/.test(
    lower,
  );
}

function isActivityIntent(lower: string): boolean {
  return (
    /\b(activity|history)\b/.test(lower) &&
    /\b(task|follow-?up|follow up)\b/.test(lower)
  );
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
