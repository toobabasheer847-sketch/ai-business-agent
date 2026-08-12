import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { users } from '../../database/drizzle/schema';

/** Never include passwordHash in API-facing selects. */
const RETURNING_COLUMNS = {
  id: users.id,
  tenantId: users.tenantId,
  name: users.name,
  email: users.email,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export interface ListUsersOptions {
  isActive?: boolean;
  search?: string;
}

@Injectable()
export class UserRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findAllByTenant(tenantId: string, options: ListUsersOptions = {}) {
    const { isActive, search } = options;

    const conditions = [eq(users.tenantId, tenantId)];

    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(users.name, `%${search.trim()}%`),
          ilike(users.email, `%${search.trim()}%`),
        )!,
      );
    }

    return this.db
      .select(RETURNING_COLUMNS)
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.users.findFirst({
      where: and(
        eq(users.id, id),
        eq(users.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Email lookup used for uniqueness checks (login is global by email).
   * Does not return passwordHash.
   */
  async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        tenantId: true,
        email: true,
      },
    });
  }

  async create(input: {
    tenantId: string;
    name: string;
    email: string;
    passwordHash: string;
    isActive?: boolean;
  }) {
    const [row] = await this.db
      .insert(users)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        isActive: input.isActive ?? true,
      })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      name?: string;
      email?: string;
      passwordHash?: string;
      isActive?: boolean;
    },
  ) {
    const values: Partial<typeof users.$inferInsert> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.email !== undefined) values.email = input.email;
    if (input.passwordHash !== undefined) values.passwordHash = input.passwordHash;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await this.db
      .update(users)
      .set(values)
      .where(
        and(
          eq(users.id, id),
          eq(users.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
