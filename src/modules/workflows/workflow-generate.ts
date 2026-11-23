import { validateDefinition } from './workflow-definition';
import { DEFAULT_SETTINGS, type WorkflowDefinition } from './workflow.types';

export type GenerationResult = {
  proposal: WorkflowDefinition | null;
  valid: boolean;
  errors: string[];
  missing: string[];
  unsupported: string[];
  source: 'rule' | 'model';
  summary: string;
};

const UNSAFE =
  /drop\s+table|delete\s+from|\bjavascript\b|\beval\s*\(|\bshell\b|\brm\s+-|<\s*script/i;

export function interpretInstruction(instruction: string): GenerationResult {
  const text = instruction.trim();
  if (text.length < 8) {
    return empty('rule', 'Describe the trigger and the action you want.');
  }
  if (UNSAFE.test(text)) {
    return {
      proposal: null,
      valid: false,
      errors: ['The instruction asks for an unsupported or unsafe operation.'],
      missing: [],
      unsupported: ['arbitrary code or data deletion'],
      source: 'rule',
      summary: 'This request cannot become a workflow.',
    };
  }
  const proposal = match(text);
  if (!proposal) {
    return {
      proposal: null,
      valid: false,
      errors: [],
      missing: [],
      unsupported: [
        'The instruction does not map to a supported trigger and action.',
      ],
      source: 'rule',
      summary:
        'Write the workflow manually, or name a supported trigger such as a new lead, an overdue task, or an expiring proposal.',
    };
  }
  if ('missing' in proposal) {
    return {
      proposal: null,
      valid: false,
      errors: [],
      missing: proposal.missing,
      unsupported: [],
      source: 'rule',
      summary: 'The request needs details before it can be validated.',
    };
  }
  const validated = validateDefinition(proposal);
  if (!validated.ok) {
    return {
      proposal: null,
      valid: false,
      errors: validated.errors,
      missing: [],
      unsupported: [],
      source: 'rule',
      summary: 'The interpreted workflow did not pass validation.',
    };
  }
  return {
    proposal: validated.definition,
    valid: true,
    errors: [],
    missing: [],
    unsupported: [],
    source: 'rule',
    summary:
      'This is a suggested definition. It is not active until you save and activate it.',
  };
}

export function acceptModelProposal(raw: unknown): GenerationResult {
  const validated = validateDefinition(raw);
  if (!validated.ok) {
    return {
      proposal: null,
      valid: false,
      errors: validated.errors,
      missing: [],
      unsupported: [],
      source: 'model',
      summary: 'The model proposal was rejected by validation.',
    };
  }
  return {
    proposal: validated.definition,
    valid: true,
    errors: [],
    missing: [],
    unsupported: [],
    source: 'model',
    summary:
      'The model proposed this definition. It is not active until you save and activate it.',
  };
}

function match(
  text: string,
): WorkflowDefinition | { missing: string[] } | null {
  const lower = text.toLowerCase();
  if (
    /send (an )?email|email the customer/.test(lower) &&
    !extractEmail(text)
  ) {
    return { missing: ['recipient email', 'subject', 'body'] };
  }
  if (/send (an )?sms|text the customer/.test(lower)) {
    return { missing: ['recipient phone', 'fromPhoneNumberId', 'body'] };
  }
  if (/not been contacted|has not been contacted|uncontacted/.test(lower)) {
    return definition(
      'scheduled',
      { hourUtc: 8 },
      [{ field: 'lead.status', operator: 'eq', value: 'new' }],
      [
        action('follow-up', 'create_task', {
          title: 'Follow up with uncontacted lead',
          useTriggerLead: 'true',
        }),
      ],
    );
  }
  if (/every monday/.test(lower) && /summary|overdue/.test(lower)) {
    return definition(
      'scheduled',
      { hourUtc: 8, weekday: 1 },
      [],
      [
        action('summary', 'generate_business_summary', {
          topic: 'overdue tasks',
        }),
      ],
    );
  }
  if (/proposal/.test(lower) && /expir/.test(lower)) {
    if (/email/.test(lower)) {
      return definition(
        'proposal_expiring',
        { withinDays: 3 },
        [],
        [
          action('follow-up', 'create_email_draft', {
            body: 'The proposal is nearing its validity date.',
            subject: 'Proposal follow-up',
          }),
        ],
      );
    }
    return definition(
      'proposal_expiring',
      { withinDays: 3 },
      [],
      [
        action('follow-up', 'create_internal_notification', {
          message: 'A proposal is nearing its validity date.',
        }),
      ],
    );
  }
  if (/exception/.test(lower) && /task/.test(lower)) {
    const severity = /critical/.test(lower) ? 'critical' : 'high';
    return definition(
      'exception_detected',
      { severity },
      [],
      [
        action('review', 'create_task', {
          title: 'Review a high-priority exception',
        }),
      ],
    );
  }
  if (/new lead/.test(lower) && /task/.test(lower)) {
    return definition(
      'new_lead',
      {},
      [],
      [
        action('follow-up', 'create_task', {
          title: 'Follow up with new lead',
          useTriggerLead: 'true',
        }),
      ],
    );
  }
  if (/overdue task/.test(lower)) {
    return definition(
      'task_overdue',
      {},
      [],
      [
        action('review', 'create_internal_notification', {
          message: 'A task is overdue.',
        }),
      ],
    );
  }
  return null;
}

function definition(
  type: WorkflowDefinition['trigger']['type'],
  trigger: Omit<WorkflowDefinition['trigger'], 'type'>,
  conditions: WorkflowDefinition['conditions'],
  actions: WorkflowDefinition['actions'],
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    trigger: { type, ...trigger },
    conditions,
    actions,
    settings: { ...DEFAULT_SETTINGS },
  };
}

function action(
  key: string,
  type: WorkflowDefinition['actions'][number]['type'],
  input: Record<string, string>,
): WorkflowDefinition['actions'][number] {
  return { key, type, input };
}

function extractEmail(text: string) {
  return text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
}

function empty(source: 'rule' | 'model', summary: string): GenerationResult {
  return {
    proposal: null,
    valid: false,
    errors: [summary],
    missing: [],
    unsupported: [],
    source,
    summary,
  };
}
