import { scoreException } from './exception-priority';

describe('scoreException', () => {
  it('keeps severity separate from the numeric score and explains the score', () => {
    const result = scoreException({
      severity: 'high',
      daysOverdue: 4,
      occurrenceCount: 2,
      acknowledged: false,
    });
    expect(result.score).toBe(81);
    expect(result.reason).toBe(
      'Priority 81 because this is High severity, overdue by 4 days, seen 2 times, not yet acknowledged.',
    );
  });

  it('lowers the score after acknowledgement without changing the severity input', () => {
    const open = scoreException({
      severity: 'critical',
      daysOverdue: 0,
      occurrenceCount: 1,
      acknowledged: false,
    });
    const acknowledged = scoreException({
      severity: 'critical',
      daysOverdue: 0,
      occurrenceCount: 1,
      acknowledged: true,
    });
    expect(open.score - acknowledged.score).toBe(25);
    expect(acknowledged.reason).toContain('already acknowledged');
  });
});
