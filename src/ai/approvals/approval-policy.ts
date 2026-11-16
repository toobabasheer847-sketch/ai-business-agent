import { hasPermission, Permission, type PermissionName } from '../../modules/authorization/permissions';

export type ApprovalRisk = 'low' | 'medium' | 'high';

export type ApprovalPolicy = {
  actionType: string;
  required: boolean;
  riskLevel: ApprovalRisk;
  reason: string;
  permission: PermissionName | null;
  editableFields: string[];
};

const ALWAYS: Record<string, Omit<ApprovalPolicy, 'actionType' | 'required'> & { required: true }> = {
  'proposal.send': {
    required: true,
    riskLevel: 'high',
    reason: 'Sending a proposal is visible to the customer and cannot be recalled from their inbox.',
    permission: Permission.ProposalSend,
    editableFields: [],
  },
  'company.delete': {
    required: true,
    riskLevel: 'high',
    reason: 'Deleting a company removes the business record and cannot be undone from this screen.',
    permission: Permission.CompanyDelete,
    editableFields: [],
  },
  'email.send': {
    required: true,
    riskLevel: 'high',
    reason: 'A customer-facing email is sent only after a person approves the recipient and content.',
    permission: Permission.CommunicationView,
    editableFields: ['subject', 'body'],
  },
  'sms.send': {
    required: true,
    riskLevel: 'high',
    reason: 'An SMS is sent only after a person approves the recipient and message.',
    permission: Permission.CommunicationView,
    editableFields: ['body'],
  },
  'call.initiate': {
    required: true,
    riskLevel: 'high',
    reason: 'An outbound call is placed only after a person approves the recipient.',
    permission: Permission.CommunicationView,
    editableFields: [],
  },
};

const CONFIGURABLE = new Set([
  'company.create',
  'company.update',
  'lead.update',
  'task.create',
  'task.update',
]);

const NO_APPROVAL = new Set([
  'company.read',
  'lead.read',
  'task.read',
  'proposal.read',
  'proposal.create',
  'search',
  'analytics.overview',
  'analytics.sales',
  'analytics.proposals',
  'analytics.tasks',
  'team.analyze',
  'communication.summary',
  'dashboard.read',
  'knowledge.answer',
  'email.draft',
]);

export function parseExtraApprovalActions(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((item) => item.trim()).filter((item) => CONFIGURABLE.has(item));
}

export function evaluateApproval(actionType: string, extraRequired: string[] = []): ApprovalPolicy {
  const always = ALWAYS[actionType];
  if (always) return { actionType, ...always };
  if (CONFIGURABLE.has(actionType)) {
    const required = extraRequired.includes(actionType);
    return {
      actionType,
      required,
      riskLevel: required ? 'medium' : 'low',
      reason: required
        ? 'This internal change is on the configured approval list.'
        : 'This internal change does not require approval under the current policy.',
      permission: permissionForConfigurable(actionType),
      editableFields: [],
    };
  }
  return {
    actionType,
    required: false,
    riskLevel: 'low',
    reason: NO_APPROVAL.has(actionType)
      ? 'Reading, summarizing, and unsent drafts do not require approval.'
      : 'This action is not classified as externally visible or irreversible.',
    permission: null,
    editableFields: [],
  };
}

export function canDecideApproval(role: unknown, policy: ApprovalPolicy): boolean {
  if (!policy.permission) return false;
  return hasPermission(role, policy.permission);
}

function permissionForConfigurable(actionType: string): PermissionName {
  if (actionType.startsWith('company.')) return Permission.CompanyCreate;
  if (actionType.startsWith('lead.')) return Permission.LeadManage;
  if (actionType === 'task.create') return Permission.TaskCreate;
  return Permission.TaskUpdateAssigned;
}
