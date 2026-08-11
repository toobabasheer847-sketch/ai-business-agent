import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { tenants } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: tenants.id,
  name: tenants.name,
  createdAt: tenants.createdAt,
  updatedAt: tenants.updatedAt,
} as const;

@Injectable()
export class TenantRepository {
  async findById(id: string) {
    return db.query.tenants.findFirst({
      where: eq(tenants.id, id),
      columns: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(
    id: string,
    input: {
      name?: string;
    },
  ) {
    const values: Partial<typeof tenants.$inferInsert> = {};

    if (input.name !== undefined) values.name = input.name;

    if (Object.keys(values).length === 0) {
      return this.findById(id);
    }

    const [row] = await db
      .update(tenants)
      .set(values)
      .where(eq(tenants.id, id))
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }
}
