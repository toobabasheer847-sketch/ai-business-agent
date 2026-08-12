import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { knowledgebases } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: knowledgebases.id,
  tenantId: knowledgebases.tenantId,
  name: knowledgebases.name,
  description: knowledgebases.description,
  createdAt: knowledgebases.createdAt,
  updatedAt: knowledgebases.updatedAt,
} as const;

@Injectable()
export class KnowledgebaseRepository {
  async findAllByTenant(tenantId: string, search?: string) {
    const baseWhere = eq(knowledgebases.tenantId, tenantId);

    if (search && search.trim()) {
      return db
        .select(RETURNING_COLUMNS)
        .from(knowledgebases)
        .where(
          and(
            baseWhere,
            ilike(knowledgebases.name, `%${search.trim()}%`),
          ),
        )
        .orderBy(desc(knowledgebases.updatedAt));
    }

    return db
      .select(RETURNING_COLUMNS)
      .from(knowledgebases)
      .where(baseWhere)
      .orderBy(desc(knowledgebases.updatedAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return db.query.knowledgebases.findFirst({
      where: and(
        eq(knowledgebases.id, id),
        eq(knowledgebases.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByNameAndTenant(name: string, tenantId: string) {
    return db.query.knowledgebases.findFirst({
      where: and(
        eq(knowledgebases.tenantId, tenantId),
        eq(knowledgebases.name, name),
      ),
    });
  }

  async create(input: {
    tenantId: string;
    name: string;
    description?: string;
  }) {
    const [row] = await db
      .insert(knowledgebases)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
      })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      name?: string;
      description?: string | null;
    },
  ) {
    const values: Partial<typeof knowledgebases.$inferInsert> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await db
      .update(knowledgebases)
      .set(values)
      .where(
        and(
          eq(knowledgebases.id, id),
          eq(knowledgebases.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(knowledgebases)
      .where(
        and(
          eq(knowledgebases.id, id),
          eq(knowledgebases.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
