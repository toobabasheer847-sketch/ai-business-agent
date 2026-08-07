export const formatIsoString = (date: Date): string => date.toISOString();

export const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getDateRange = (from?: string, to?: string) => ({
  from: from ? parseDate(from) : undefined,
  to: to ? parseDate(to) : undefined,
});
