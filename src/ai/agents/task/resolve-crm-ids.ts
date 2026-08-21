import { BadRequestException } from '@nestjs/common';

export type TaskCrmIds = {
  companyId?: string | null;
  prospectId?: string | null;
  leadId?: string | null;
};

export function normalizeCrmId(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return value;
}

export function normalizeCrmIds(input: TaskCrmIds): TaskCrmIds {
  return {
    companyId: normalizeCrmId(input.companyId),
    prospectId: normalizeCrmId(input.prospectId),
    leadId: normalizeCrmId(input.leadId),
  };
}

export function rejectMissingTenantCrm(
  entity: 'Company' | 'Prospect' | 'Lead',
): never {
  throw new BadRequestException(
    `${entity} not found or does not belong to your tenant.`,
  );
}
