import {
  mapLegacyActivityAction,
  sanitizeActivityMetadata,
} from './task-activity.constants';
import { buildCreateActivities, buildUpdateActivities } from './task-activity.diff';
import type { TaskRecord } from './types/task.types';

const baseTask = {
  id: 'task-1',
  tenantId: 'tenant-a',
  createdBy: 'user-a',
  assignedTo: null,
  companyId: null,
  prospectId: null,
  leadId: null,
  title: 'Call Ahmed',
  description: null,
  status: 'pending',
  priority: 'medium',
  dueAt: null,
} as TaskRecord;

describe('task activity helpers', () => {
  it('strips secrets from metadata', () => {
    expect(
      sanitizeActivityMetadata({
        channel: 'gmail',
        accessToken: 'secret',
        oauthRefreshToken: 'secret',
        recipientEmail: 'hidden@example.com',
        nested: { apiKey: 'x', scheduledAt: '2026-01-01' },
      }),
    ).toEqual({
      channel: 'gmail',
      nested: { scheduledAt: '2026-01-01' },
    });
  });

  it('maps legacy reminder audit actions', () => {
    expect(mapLegacyActivityAction('task.reminder.sent')).toBe('REMINDER_SENT');
    expect(mapLegacyActivityAction('task.reminder.failed')).toBe('REMINDER_FAILED');
    expect(mapLegacyActivityAction('TASK_CREATED')).toBe('TASK_CREATED');
  });

  it('records create and CRM link events', () => {
    const events = buildCreateActivities({
      ...baseTask,
      companyId: 'c1',
      company: { id: 'c1', name: 'NimbusForge' },
    });

    expect(events.map((event) => event.eventType)).toEqual([
      'TASK_CREATED',
      'TASK_CRM_LINKED',
    ]);
    expect(events[1].metadata).toEqual({
      type: 'company',
      id: 'c1',
      name: 'NimbusForge',
    });
  });

  it('records only changed fields on update', () => {
    const events = buildUpdateActivities(baseTask, {
      ...baseTask,
      priority: 'high',
    });

    expect(events).toEqual([
      {
        eventType: 'TASK_UPDATED',
        metadata: {
          changes: {
            priority: { from: 'medium', to: 'high' },
          },
        },
      },
    ]);
  });

  it('records complete, cancel, reopen, and CRM unlink', () => {
    expect(
      buildUpdateActivities(baseTask, { ...baseTask, status: 'completed' }).map(
        (event) => event.eventType,
      ),
    ).toEqual(['TASK_COMPLETED']);

    expect(
      buildUpdateActivities(baseTask, { ...baseTask, status: 'cancelled' }).map(
        (event) => event.eventType,
      ),
    ).toEqual(['TASK_CANCELLED']);

    expect(
      buildUpdateActivities(
        { ...baseTask, status: 'completed' },
        { ...baseTask, status: 'pending' },
      ).map((event) => event.eventType),
    ).toEqual(['TASK_REOPENED']);

    expect(
      buildUpdateActivities(
        {
          ...baseTask,
          companyId: 'c1',
          company: { id: 'c1', name: 'NimbusForge' },
        },
        { ...baseTask, companyId: null, company: null },
      ),
    ).toEqual([
      {
        eventType: 'TASK_CRM_UNLINKED',
        metadata: { type: 'company', id: 'c1', name: 'NimbusForge' },
      },
    ]);
  });
});
