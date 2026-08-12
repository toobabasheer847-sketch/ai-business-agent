import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { proposals, prospects } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: proposals.id,
  tenantId: proposals.tenantId,
  prospectId: proposals.prospectId,
  createdBy: proposals.createdBy,
  title: proposals.title,
  description: proposals.description,
  status: proposals.status,
  content: proposals.content,
  createdAt: proposals.createdAt,
  updatedAt: proposals.updatedAt,
} as const;

export interface ListProposalsOptions {
  status?: string;
  prospectId?: string;
  createdBy?: string;
  search?: string;
}

@Injectable()
export class ProposalRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  /**
   * Verify a prospect belongs to the tenant before creating/relating a proposal.
   */
  async findProspectByIdAndTenant(prospectId: string, tenantId: string) {
    return this.db.query.prospects.findFirst({
      where: and(
        eq(prospects.id, prospectId),
        eq(prospects.tenantId, tenantId),
      ),
      columns: { id: true },
    });
  }

  async findAllByTenant(tenantId: string, options: ListProposalsOptions = {}) {
    const { status, prospectId, createdBy, search } = options;

    const conditions = [eq(proposals.tenantId, tenantId)];

    if (status) {
      conditions.push(
        eq(
          proposals.status,
          status as (typeof proposals.status.enumValues)[number],
        ),
      );
    }

    if (prospectId) {
      conditions.push(eq(proposals.prospectId, prospectId));
    }

    if (createdBy) {
      conditions.push(eq(proposals.createdBy, createdBy));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(proposals.title, `%${search.trim()}%`),
          ilike(proposals.description, `%${search.trim()}%`),
        )!,
      );
    }

    return this.db
      .select(RETURNING_COLUMNS)
      .from(proposals)
      .where(and(...conditions))
      .orderBy(desc(proposals.updatedAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.proposals.findFirst({
      where: and(
        eq(proposals.id, id),
        eq(proposals.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        prospectId: true,
        createdBy: true,
        title: true,
        description: true,
        status: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(input: {
    tenantId: string;
    prospectId: string;
    createdBy?: string;
    title: string;
    description?: string;
    content?: string;
    status?: string;
  }) {
    const [row] = await this.db
      .insert(proposals)
      .values({
        tenantId: input.tenantId,
        prospectId: input.prospectId,
        createdBy: input.createdBy ?? null,
        title: input.title,
        description: input.description ?? null,
        content: input.content ?? null,
        status: (input.status ?? 'draft') as typeof proposals.$inferInsert.status,
      })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      title?: string;
      description?: string | null;
      content?: string | null;
      status?: string;
    },
  ) {
    const values: Partial<typeof proposals.$inferInsert> = {};

    if (input.title !== undefined) values.title = input.title;
    if (input.description !== undefined) values.description = input.description;
    if (input.content !== undefined) values.content = input.content;
    if (input.status !== undefined) {
      values.status = input.status as typeof proposals.$inferInsert.status;
    }

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await this.db
      .update(proposals)
      .set(values)
      .where(
        and(
          eq(proposals.id, id),
          eq(proposals.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(proposals)
      .where(
        and(
          eq(proposals.id, id),
          eq(proposals.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
