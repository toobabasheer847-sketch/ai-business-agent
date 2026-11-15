import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { auditLogs, users } from '../../database/drizzle/schema';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { hasPermission, isTenantRole, Permission, type TenantRole } from './permissions';

@Injectable()
export class AuthorizationService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  assertKnownRole(role: unknown): TenantRole {
    if (!isTenantRole(role)) {
      throw new ForbiddenException('You do not have permission for this action.');
    }
    return role;
  }

  async assertRoleAssignment(
    actor: AuthenticatedUser,
    target: { id: string; tenantId: string; role: string | null },
    nextRole: TenantRole | undefined,
    nextActive: boolean | undefined,
  ): Promise<void> {
    if (target.tenantId !== actor.tenantId) {
      await this.writeAudit({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: 'user.role_change_denied',
        entityType: 'user',
        entityId: target.id,
        description: 'Rejected a user change outside this tenant.',
      });
      throw new ForbiddenException('You cannot change a user in another tenant.');
    }

    const actorRole = this.assertKnownRole(actor.role);
    const currentRole = isTenantRole(target.role) ? target.role : null;
    if (!currentRole) {
      throw new ForbiddenException('This user has no role and cannot be changed until a role is stored.');
    }

    if (currentRole === 'owner' && actorRole !== 'owner') {
      await this.writeAudit({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: 'user.role_change_denied',
        entityType: 'user',
        entityId: target.id,
        description: 'Rejected a change to an owner account.',
      });
      throw new ForbiddenException('An admin cannot change an owner.');
    }

    if (nextRole && nextRole !== currentRole) {
      if (target.id === actor.userId) {
        await this.writeAudit({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'user.role_change_denied',
          entityType: 'user',
          entityId: target.id,
          description: 'Rejected a self role change.',
        });
        throw new ForbiddenException('You cannot change your own role.');
      }
      if (!hasPermission(actorRole, Permission.TeamChangeRole)) {
        await this.writeAudit({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'user.role_change_denied',
          entityType: 'user',
          entityId: target.id,
          description: 'Rejected a role change.',
        });
        throw new ForbiddenException('Only an owner can change roles.');
      }
      if (currentRole === 'owner' && nextRole !== 'owner') {
        await this.assertNotLastOwner(actor.tenantId, target.id);
      }
    }

    if (nextActive === false && currentRole === 'owner') {
      if (actorRole !== 'owner') {
        throw new ForbiddenException('Only an owner can deactivate an owner.');
      }
      await this.assertNotLastOwner(actor.tenantId, target.id);
    }

  }

  async assertCanRemove(actor: AuthenticatedUser, target: { id: string; tenantId: string; role: string | null }): Promise<void> {
    if (target.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You cannot remove a user in another tenant.');
    }
    if (isTenantRole(target.role) && target.role === 'owner') {
      if (actor.role !== 'owner') {
        throw new ForbiddenException('Only an owner can remove an owner.');
      }
      await this.assertNotLastOwner(actor.tenantId, target.id);
    }
  }

  assertCreatableRole(actor: AuthenticatedUser, requested: TenantRole | undefined): TenantRole {
    const role = requested ?? 'member';
    if (!isTenantRole(role)) {
      throw new BadRequestException('Role must be owner, admin, or member.');
    }
    if (role === 'member') return role;
    if (!hasPermission(actor.role, Permission.TeamChangeRole)) {
      throw new ForbiddenException('Only an owner can assign an admin or owner role.');
    }
    return role;
  }

  async writeAudit(input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    description: string;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      metadata: {},
    });
  }

  private async assertNotLastOwner(tenantId: string, targetUserId: string): Promise<void> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner'), eq(users.isActive, true)));
    const owners = Number(row?.total ?? 0);
    if (owners <= 1) {
      throw new BadRequestException('The tenant must keep at least one active owner.');
    }
    void targetUserId;
  }
}
