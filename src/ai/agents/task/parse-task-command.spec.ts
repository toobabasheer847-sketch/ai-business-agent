import { parseTaskCommand, titleMatchesSearch } from './parse-task-command';

describe('parseTaskCommand', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('parses create with tomorrow due date', () => {
    const command = parseTaskCommand('Create a task to call Ahmed tomorrow.', {
      now,
    });

    expect(command).toEqual(
      expect.objectContaining({
        action: 'create',
        title: 'Call Ahmed',
        priority: 'medium',
        dueAt: '2026-08-21T00:00:00.000Z',
      }),
    );
  });

  it('parses a high priority create and keeps extra context in the title', () => {
    const command = parseTaskCommand(
      'Create a high priority task to call Ahmed about the proposal tomorrow.',
      { now },
    );

    expect(command.action).toBe('create');
    expect(command.title).toBe('Call Ahmed about the proposal');
    expect(command.priority).toBe('high');
    expect(command.dueAt).toBe('2026-08-21T00:00:00.000Z');
  });

  it('parses new task with next Monday', () => {
    const command = parseTaskCommand(
      'New task: follow up with ABC next Monday.',
      { now },
    );

    expect(command.action).toBe('create');
    expect(command.title).toBe('Follow up with ABC');
    expect(command.dueAt).toBe('2026-08-24T00:00:00.000Z');
  });

  it('parses remind-me creates and overdue list queries', () => {
    expect(
      parseTaskCommand('Remind me to call Ahmed tomorrow at 3 PM', { now }),
    ).toEqual(
      expect.objectContaining({
        action: 'create',
        title: 'Call Ahmed',
        dueAt: '2026-08-21T15:00:00.000Z',
      }),
    );
    expect(
      parseTaskCommand(
        'Create a task to follow up with ABC tomorrow and remind me at 2 PM',
        { now },
      ),
    ).toEqual(
      expect.objectContaining({
        action: 'create',
        title: 'Follow up with ABC',
        dueAt: '2026-08-21T14:00:00.000Z',
        personQuery: 'ABC',
      }),
    );
    expect(parseTaskCommand('Show my overdue tasks.')).toEqual(
      expect.objectContaining({
        action: 'list',
        dueOn: 'overdue',
      }),
    );
    expect(parseTaskCommand('Show tasks due today.')).toEqual(
      expect.objectContaining({
        action: 'list',
        dueOn: 'today',
      }),
    );
    expect(parseTaskCommand('Show tasks due tomorrow.')).toEqual(
      expect.objectContaining({
        action: 'list',
        dueOn: 'tomorrow',
      }),
    );
    expect(parseTaskCommand('Show my overdue tasks for ABC.')).toEqual(
      expect.objectContaining({
        action: 'list',
        dueOn: 'overdue',
        personQuery: 'ABC',
      }),
    );
  });

  it('parses list pending tasks', () => {
    expect(parseTaskCommand('Show my pending tasks.')).toEqual(
      expect.objectContaining({
        action: 'list',
        status: 'pending',
      }),
    );
  });

  it('parses list high priority and today filters', () => {
    expect(parseTaskCommand('List my high priority tasks.')).toEqual(
      expect.objectContaining({
        action: 'list',
        priority: 'high',
      }),
    );
    expect(parseTaskCommand('Show my tasks for today.')).toEqual(
      expect.objectContaining({
        action: 'list',
        dueOn: 'today',
      }),
    );
  });

  it('parses complete and cancel by title', () => {
    expect(
      parseTaskCommand('Mark my ABC follow-up task as completed.'),
    ).toEqual(
      expect.objectContaining({
        action: 'complete',
        searchTerm: 'ABC follow-up',
      }),
    );
    expect(parseTaskCommand('Complete the task to call Ahmed.')).toEqual(
      expect.objectContaining({
        action: 'complete',
        searchTerm: 'call Ahmed',
      }),
    );
    expect(parseTaskCommand('Cancel my ABC follow-up task.')).toEqual(
      expect.objectContaining({
        action: 'cancel',
        searchTerm: 'ABC follow-up',
      }),
    );
  });

  it('parses priority and status updates', () => {
    expect(
      parseTaskCommand('Change my ABC task priority to high.'),
    ).toEqual(
      expect.objectContaining({
        action: 'update',
        priority: 'high',
        searchTerm: 'ABC',
      }),
    );
    expect(parseTaskCommand('Set the call Ahmed task to urgent.')).toEqual(
      expect.objectContaining({
        action: 'update',
        priority: 'urgent',
        searchTerm: 'call Ahmed',
      }),
    );
    expect(parseTaskCommand('Make my follow-up task low priority.')).toEqual(
      expect.objectContaining({
        action: 'update',
        priority: 'low',
        searchTerm: 'follow-up',
      }),
    );
    expect(parseTaskCommand('Move my task to in progress.')).toEqual(
      expect.objectContaining({
        action: 'update',
        status: 'in_progress',
      }),
    );
    expect(parseTaskCommand('Set my ABC task to pending.')).toEqual(
      expect.objectContaining({
        action: 'update',
        status: 'pending',
        searchTerm: 'ABC',
      }),
    );
  });

  it('parses get by title', () => {
    expect(parseTaskCommand('Show my ABC follow-up task.')).toEqual(
      expect.objectContaining({
        action: 'get',
        searchTerm: 'ABC follow-up',
      }),
    );
    expect(parseTaskCommand('Get the task to call Ahmed.')).toEqual(
      expect.objectContaining({
        action: 'get',
        searchTerm: 'call Ahmed',
      }),
    );
  });

  it('parses activity and history requests', () => {
    expect(parseTaskCommand('Show activity for my Ahmed task.')).toEqual(
      expect.objectContaining({
        action: 'activity',
        searchTerm: 'Ahmed',
      }),
    );
    expect(
      parseTaskCommand('Show the history of my NimbusForge follow-up task.'),
    ).toEqual(
      expect.objectContaining({
        action: 'activity',
        searchTerm: 'NimbusForge follow-up',
      }),
    );
  });

  it('ignores tenantId and createdBy in the text', () => {
    const command = parseTaskCommand(
      'Create a task to call Ahmed tomorrow tenantId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb createdBy=attacker',
      { now },
    );

    expect(command.action).toBe('create');
    expect(command.title).toBe('Call Ahmed');
    expect(JSON.stringify(command)).not.toMatch(/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
    expect(JSON.stringify(command)).not.toMatch(/attacker/);
  });

  it('rejects invalid priority, status, date, and time', () => {
    expect(
      parseTaskCommand('Change my ABC task priority to critical.').action,
    ).toBe('clarify');
    expect(parseTaskCommand('Move my task to done.').action).toBe('clarify');
    expect(
      parseTaskCommand('Create a task to call Ahmed on 2026-13-99.', { now })
        .action,
    ).toBe('clarify');
    expect(
      parseTaskCommand('Create a task to call Ahmed tomorrow at 13 PM.', {
        now,
      }).action,
    ).toBe('clarify');
  });

  it('matches titles by tokens without requiring identical wording', () => {
    expect(titleMatchesSearch('Follow up with ABC', 'ABC follow-up')).toBe(true);
    expect(titleMatchesSearch('Call Ahmed', 'call Ahmed')).toBe(true);
    expect(titleMatchesSearch('Follow up with Ahmed', 'ABC follow-up')).toBe(
      false,
    );
  });
});
