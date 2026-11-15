import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { auditLogs } from '../../database/drizzle/schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        description: auditLogs.description,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
      })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
  }
}
