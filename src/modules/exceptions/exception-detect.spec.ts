import { detectExceptions } from './exception-detect';
import type { DetectionSnapshot } from './exception.types';

const now = new Date('2026-11-16T12:00:00.000Z');

function snapshot(partial: Partial<DetectionSnapshot>): DetectionSnapshot {
  return {
    now,
    truncated: false,
    tasks: [],
    leads: [],
    prospects: [],
    proposals: [],
    reminders: [],
    runs: [],
    approvals: [],
    ...partial,
  };
}

describe('detectExceptions', () => {
  it('detects an overdue task from its due timestamp', () => {
    const drafts = detectExceptions(
      snapshot({
        tasks: [
          {
            id: 'task-1',
            title: 'Send invoice',
            status: 'pending',
            priority: 'medium',
            dueAt: new Date('2026-11-12T12:00:00.000Z'),
            createdAt: new Date('2026-11-01T12:00:00.000Z'),
            assignedTo: 'user-1',
            assigneeActive: true,
            companyId: null,
          },
        ],
      }),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      exceptionKey: 'task:task-1',
      severity: 'critical',
      recommendedActionType: 'review_task',
    });
    expect(drafts[0].description).toContain('overdue by 4 days');
  });

  it('treats a new lead older than the threshold as uncontacted', () => {
    const drafts = detectExceptions(
      snapshot({
        leads: [
          {
            id: 'lead-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            phone: null,
            status: 'new',
            createdAt: new Date('2026-11-10T12:00:00.000Z'),
            companyId: null,
          },
        ],
      }),
    );
    expect(drafts[0]).toMatchObject({
      exceptionKey: 'lead:lead-1:uncontacted',
      category: 'sales',
      severity: 'high',
    });
    expect(drafts[0].description).toContain('No follow-up log exists');
  });

  it('detects a sent proposal that has no viewed timestamp', () => {
    const drafts = detectExceptions(
      snapshot({
        proposals: [
          {
            id: 'proposal-1',
            title: 'Website',
            status: 'sent',
            sentAt: new Date('2026-11-10T12:00:00.000Z'),
            viewedAt: null,
            validUntil: new Date('2026-12-01T12:00:00.000Z'),
          },
        ],
      }),
    );
    expect(drafts[0]).toMatchObject({
      exceptionKey: 'proposal:proposal-1',
      severity: 'high',
    });
    expect(drafts[0].metadata.rule).toBe('not-viewed');
  });

  it('detects an expired proposal from its validity timestamp', () => {
    const drafts = detectExceptions(
      snapshot({
        proposals: [
          {
            id: 'proposal-2',
            title: 'Retainer',
            status: 'viewed',
            sentAt: new Date('2026-10-01T12:00:00.000Z'),
            viewedAt: new Date('2026-10-02T12:00:00.000Z'),
            validUntil: new Date('2026-11-01T12:00:00.000Z'),
          },
        ],
      }),
    );
    expect(drafts[0].metadata.rule).toBe('expired');
    expect(drafts[0].metadata.daysOverdue).toBe(15);
    expect(drafts[0].severity).toBe('critical');
  });

  it('detects a failed reminder without storing the provider error', () => {
    const drafts = detectExceptions(
      snapshot({
        reminders: [
          {
            id: 'reminder-1',
            taskId: 'task-9',
            status: 'failed',
            attemptCount: 2,
            channel: 'email',
          },
        ],
      }),
    );
    expect(drafts[0]).toMatchObject({
      category: 'communication',
      recommendedActionType: 'review_delivery',
    });
    expect(JSON.stringify(drafts[0])).not.toContain('send_email');
    expect(drafts[0].description).toContain('does not send another message');
  });

  it('collapses repeated agent failures into one exception', () => {
    const run = (id: string) => ({
      id,
      agentName: 'proposal',
      status: 'failed',
      durationMs: 100,
      costStatus: 'priced',
      startedAt: now,
    });
    const drafts = detectExceptions(
      snapshot({ runs: [run('a'), run('b'), run('c')] }),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].exceptionKey).toBe('agent:proposal:failures');
  });

  it('detects a pending approval that is still inside its expiry window', () => {
    const drafts = detectExceptions(
      snapshot({
        approvals: [
          {
            id: 'approval-1',
            title: 'Send proposal',
            status: 'pending',
            actionType: 'proposal.send',
            createdAt: new Date('2026-11-15T12:00:00.000Z'),
            expiresAt: new Date('2026-11-17T12:00:00.000Z'),
          },
        ],
      }),
    );
    expect(drafts[0]).toMatchObject({
      category: 'approval',
      sourceType: 'ai_approval',
      severity: 'high',
    });
  });

  it('flags a completed run when pricing is not configured', () => {
    const drafts = detectExceptions(
      snapshot({
        runs: [
          {
            id: 'run-price',
            agentName: 'proposal',
            status: 'completed',
            durationMs: 100,
            costStatus: 'pricing_not_configured',
            startedAt: now,
          },
        ],
      }),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].metadata.rule).toBe('pricing');
  });

  it('ignores embedding runs whose provider does not return token usage', () => {
    const drafts = detectExceptions(
      snapshot({
        runs: [
          {
            id: 'run-embed',
            agentName: 'knowledge-embedding',
            status: 'completed',
            durationMs: 40,
            costStatus: 'usage_unavailable',
            startedAt: now,
          },
        ],
      }),
    );
    expect(drafts).toHaveLength(0);
  });

  it('redacts secret-like text and drops secret metadata keys', () => {
    const drafts = detectExceptions(
      snapshot({
        tasks: [
          {
            id: 'task-secret',
            title: 'Rotate token',
            status: 'pending',
            priority: 'low',
            dueAt: null,
            createdAt: new Date('2026-10-01T12:00:00.000Z'),
            assignedTo: null,
            assigneeActive: null,
            companyId: null,
          },
        ],
      }),
    );
    expect(drafts[0].title).toContain('[redacted]');
    expect(drafts[0].metadata).not.toHaveProperty('password');
  });
});
