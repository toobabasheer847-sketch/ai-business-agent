import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { tenants, users } from '../../database/drizzle/schema';

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findUserByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  async findUserById(id: string) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  async createTenantAndUser(input: {
    tenantName: string;
    name: string;
    email: string;
    passwordHash: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: input.tenantName,
        })
        .returning({
          id: tenants.id,
          name: tenants.name,
        });

      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          isActive: true,
        })
        .returning({
          id: users.id,
          tenantId: users.tenantId,
          name: users.name,
          email: users.email,
          isActive: users.isActive,
        });

      return { tenant, user };
    });
  }
}
