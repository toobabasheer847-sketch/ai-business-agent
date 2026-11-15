export function scheduledJobsEnabled(value: string | undefined | null): boolean {
  if (value == null || value.trim() === '') {
    return true;
  }

  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}
