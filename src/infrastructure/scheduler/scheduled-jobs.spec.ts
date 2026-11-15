import { scheduledJobsEnabled } from './scheduled-jobs';

describe('scheduledJobsEnabled', () => {
  it('keeps jobs on when the setting is omitted', () => {
    expect(scheduledJobsEnabled(undefined)).toBe(true);
    expect(scheduledJobsEnabled('')).toBe(true);
  });

  it('turns jobs off for the maintenance values', () => {
    expect(scheduledJobsEnabled('false')).toBe(false);
    expect(scheduledJobsEnabled('off')).toBe(false);
    expect(scheduledJobsEnabled('0')).toBe(false);
  });
});
