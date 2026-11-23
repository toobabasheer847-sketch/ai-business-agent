import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  workflowExecutionSteps,
  workflowExecutions,
  workflows,
  workflowVersions,
} from '../../database/drizzle/schema/workflow.schema';
import type { WorkflowStore } from './workflow-engine';
import { validateDefinition } from './workflow-definition';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowRecord,
  WorkflowStep,
} from './workflow.types';

@Injectable()
export class DrizzleWorkflowStore implements WorkflowStore {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async insertWorkflow(row: WorkflowRecord) {
    const [saved] = await this.db
      .insert(workflows)
      .values(this.toWorkflow(row))
      .returning();
    return this.fromWorkflow(saved);
  }

  async saveWorkflow(row: WorkflowRecord) {
    const [saved] = await this.db
      .update(workflows)
      .set({
        ...this.toWorkflow(row),
        updatedAt: new Date(),
      })
      .where(
        and(eq(workflows.id, row.id), eq(workflows.tenantId, row.tenantId)),
      )
      .returning();
    return this.fromWorkflow(saved);
  }

  async findWorkflow(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
      .limit(1);
    return row ? this.fromWorkflow(row) : null;
  }

  async list(
    tenantId: string,
    query: { search?: string; status?: string; limit: number; offset: number },
  ) {
    const where = and(
      eq(workflows.tenantId, tenantId),
      query.status ? eq(workflows.status, query.status) : undefined,
      query.search
        ? or(
            ilike(workflows.name, `%${query.search.replace(/[%_]/g, '')}%`),
            ilike(
              workflows.description,
              `%${query.search.replace(/[%_]/g, '')}%`,
            ),
          )
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(workflows)
        .where(where)
        .orderBy(desc(workflows.updatedAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ total: count() }).from(workflows).where(where),
    ]);
    return {
      data: rows.map((row) => this.fromWorkflow(row)),
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async summary(tenantId: string) {
    const rows = await this.db
      .select({
        status: workflows.status,
        total: sql<number>`count(*)::int`,
      })
      .from(workflows)
      .where(eq(workflows.tenantId, tenantId))
      .groupBy(workflows.status);
    const executions = await this.db
      .select({
        status: workflowExecutions.status,
        total: sql<number>`count(*)::int`,
      })
      .from(workflowExecutions)
      .where(eq(workflowExecutions.tenantId, tenantId))
      .groupBy(workflowExecutions.status);
    const summary = {
      total: 0,
      active: 0,
      paused: 0,
      draft: 0,
      completed: 0,
      failed: 0,
      waiting: 0,
    };
    for (const row of rows) {
      const total = Number(row.total);
      summary.total += total;
      if (
        row.status === 'active' ||
        row.status === 'paused' ||
        row.status === 'draft'
      )
        summary[row.status] += total;
    }
    for (const row of executions) {
      const total = Number(row.total);
      if (row.status === 'completed') summary.completed += total;
      if (row.status === 'failed' || row.status === 'partially_completed')
        summary.failed += total;
      if (row.status === 'waiting_for_approval') summary.waiting += total;
    }
    return summary;
  }

  async recentFailures(tenantId: string) {
    const rows = await this.db
      .select()
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.tenantId, tenantId),
          sql`${workflowExecutions.status} in ('failed', 'partially_completed')`,
        ),
      )
      .orderBy(desc(workflowExecutions.startedAt))
      .limit(5);
    return rows.map((row) => this.fromExecution(row));
  }

  async active(tenantId: string) {
    const rows = await this.db
      .select()
      .from(workflows)
      .where(
        and(eq(workflows.tenantId, tenantId), eq(workflows.status, 'active')),
      )
      .limit(100);
    return rows.map((row) => this.fromWorkflow(row));
  }

  async waiting(tenantId: string) {
    const rows = await this.db
      .select()
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.tenantId, tenantId),
          eq(workflowExecutions.status, 'waiting_for_approval'),
        ),
      )
      .limit(50);
    return rows.map((row) => this.fromExecution(row));
  }

  async executionForApproval(tenantId: string, approvalId: string) {
    const [step] = await this.db
      .select()
      .from(workflowExecutionSteps)
      .where(
        and(
          eq(workflowExecutionSteps.tenantId, tenantId),
          eq(workflowExecutionSteps.approvalId, approvalId),
        ),
      )
      .limit(1);
    if (!step) return null;
    return this.findExecution(tenantId, step.executionId);
  }

  async insertVersion(input: {
    tenantId: string;
    workflowId: string;
    version: number;
    definition: WorkflowDefinition;
    createdBy: string | null;
  }) {
    await this.db.insert(workflowVersions).values({
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      version: input.version,
      definitionSnapshot: input.definition,
      createdBy: input.createdBy,
    });
  }

  async insertExecution(row: WorkflowExecution) {
    try {
      const [saved] = await this.db
        .insert(workflowExecutions)
        .values(this.toExecution(row))
        .returning();
      return { row: this.fromExecution(saved), created: true };
    } catch (error) {
      if (!isUnique(error)) throw error;
      const existing = await this.findByReference(
        row.tenantId,
        row.workflowId,
        row.triggerReference,
      );
      if (!existing) throw error;
      return { row: existing, created: false };
    }
  }

  async saveExecution(row: WorkflowExecution) {
    const [saved] = await this.db
      .update(workflowExecutions)
      .set({
        ...this.toExecution(row),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflowExecutions.id, row.id),
          eq(workflowExecutions.tenantId, row.tenantId),
        ),
      )
      .returning();
    return this.fromExecution(saved);
  }

  async findExecution(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.id, id),
          eq(workflowExecutions.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? this.fromExecution(row) : null;
  }

  async listExecutions(
    tenantId: string,
    workflowId: string,
    limit: number,
    offset: number,
  ) {
    const where = and(
      eq(workflowExecutions.tenantId, tenantId),
      eq(workflowExecutions.workflowId, workflowId),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(workflowExecutions)
        .where(where)
        .orderBy(desc(workflowExecutions.startedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(workflowExecutions).where(where),
    ]);
    return {
      data: rows.map((row) => this.fromExecution(row)),
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async insertStep(row: WorkflowStep) {
    const [saved] = await this.db
      .insert(workflowExecutionSteps)
      .values(this.toStep(row))
      .returning();
    return this.fromStep(saved);
  }

  async saveStep(row: WorkflowStep) {
    const [saved] = await this.db
      .update(workflowExecutionSteps)
      .set(this.toStep(row))
      .where(
        and(
          eq(workflowExecutionSteps.id, row.id),
          eq(workflowExecutionSteps.tenantId, row.tenantId),
        ),
      )
      .returning();
    return this.fromStep(saved);
  }

  async steps(tenantId: string, executionId: string) {
    const rows = await this.db
      .select()
      .from(workflowExecutionSteps)
      .where(
        and(
          eq(workflowExecutionSteps.tenantId, tenantId),
          eq(workflowExecutionSteps.executionId, executionId),
        ),
      );
    return rows.map((row) => this.fromStep(row));
  }

  async tenantIds() {
    const rows = await this.db
      .select({ id: workflows.tenantId })
      .from(workflows)
      .where(eq(workflows.status, 'active'))
      .groupBy(workflows.tenantId)
      .limit(500);
    return rows.map((row) => row.id);
  }

  private async findByReference(
    tenantId: string,
    workflowId: string,
    triggerReference: string,
  ) {
    const [row] = await this.db
      .select()
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.tenantId, tenantId),
          eq(workflowExecutions.workflowId, workflowId),
          eq(workflowExecutions.triggerReference, triggerReference),
        ),
      )
      .limit(1);
    return row ? this.fromExecution(row) : null;
  }

  private toWorkflow(row: WorkflowRecord) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      status: row.status,
      triggerType: row.triggerType,
      definition: row.definition,
      version: row.version,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      activatedAt: row.activatedAt,
      pausedAt: row.pausedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private fromWorkflow(row: typeof workflows.$inferSelect): WorkflowRecord {
    const parsed = validateDefinition(row.definition);
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      status: row.status as WorkflowRecord['status'],
      triggerType: row.triggerType as WorkflowRecord['triggerType'],
      definition: parsed.ok ? parsed.definition : emptyDefinition(),
      version: row.version,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      activatedAt: row.activatedAt,
      pausedAt: row.pausedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toExecution(row: WorkflowExecution) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      workflowId: row.workflowId,
      workflowVersion: row.workflowVersion,
      triggerSource: row.triggerSource,
      triggerReference: row.triggerReference,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs: row.durationMs,
      errorCode: row.errorCode,
      sanitizedError: row.sanitizedError,
      executionContext: row.executionContext,
      triggeredBy: row.triggeredBy,
      definitionSnapshot: row.definitionSnapshot,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private fromExecution(
    row: typeof workflowExecutions.$inferSelect,
  ): WorkflowExecution {
    const parsed = validateDefinition(row.definitionSnapshot);
    return {
      id: row.id,
      tenantId: row.tenantId,
      workflowId: row.workflowId,
      workflowVersion: row.workflowVersion,
      triggerSource: row.triggerSource as WorkflowExecution['triggerSource'],
      triggerReference: row.triggerReference,
      status: row.status as WorkflowExecution['status'],
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs: row.durationMs,
      errorCode: row.errorCode,
      sanitizedError: row.sanitizedError,
      executionContext: row.executionContext ?? {},
      triggeredBy: row.triggeredBy,
      definitionSnapshot: parsed.ok ? parsed.definition : emptyDefinition(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toStep(row: WorkflowStep) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      executionId: row.executionId,
      stepKey: row.stepKey,
      actionType: row.actionType,
      status: row.status,
      inputSnapshot: row.inputSnapshot,
      outputSnapshot: row.outputSnapshot,
      approvalId: row.approvalId,
      attemptCount: row.attemptCount,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      errorCode: row.errorCode,
      sanitizedError: row.sanitizedError,
      createdAt: row.createdAt,
    };
  }

  private fromStep(
    row: typeof workflowExecutionSteps.$inferSelect,
  ): WorkflowStep {
    return {
      id: row.id,
      tenantId: row.tenantId,
      executionId: row.executionId,
      stepKey: row.stepKey,
      actionType: row.actionType as WorkflowStep['actionType'],
      status: row.status as WorkflowStep['status'],
      inputSnapshot: (row.inputSnapshot ?? {}) as Record<string, string>,
      outputSnapshot: (row.outputSnapshot ?? {}) as Record<string, unknown>,
      approvalId: row.approvalId,
      attemptCount: row.attemptCount,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      errorCode: row.errorCode,
      sanitizedError: row.sanitizedError,
      createdAt: row.createdAt,
    };
  }
}

function emptyDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    trigger: { type: 'manual' },
    conditions: [],
    actions: [],
    settings: { maxRetries: 0, timeoutMs: 1000 },
  };
}

function isUnique(error: unknown) {
  const current = error as { code?: string; cause?: { code?: string } };
  return current.code === '23505' || current.cause?.code === '23505';
}
