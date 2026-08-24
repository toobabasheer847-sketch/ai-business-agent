import { BadRequestException } from '@nestjs/common';

import { UserRepository } from '../../../modules/user/user.repository';

export async function resolveAssignedToForTenant(
  userRepository: UserRepository,
  assignedTo: string | null | undefined,
  tenantId: string,
): Promise<string | null | undefined> {
  if (assignedTo === undefined) {
    return undefined;
  }

  if (assignedTo === null || assignedTo === '') {
    return assignedTo === '' ? undefined : null;
  }

  const user = await userRepository.findByIdAndTenant(assignedTo, tenantId);

  if (!user) {
    throw new BadRequestException(
      'Assigned user must belong to the current tenant',
    );
  }

  return assignedTo;
}
