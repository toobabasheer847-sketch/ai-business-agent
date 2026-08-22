export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom'

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  last_30_days: 'Last 30 Days',
  last_90_days: 'Last 90 Days',
  custom: 'Custom Range',
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(from: Date, days: number) {
  return new Date(startOfUtcDay(from).getTime() + days * 24 * 60 * 60 * 1000)
}

function endOfUtcDay(date: Date) {
  return new Date(startOfUtcDay(date).getTime() + 24 * 60 * 60 * 1000 - 1)
}

function startOfUtcWeek(date: Date) {
  const day = date.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addUtcDays(date, mondayOffset)
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function resolveDatePresetRange(
  preset: DatePreset,
  now = new Date(),
): { from: string; to: string } | null {
  const todayStart = startOfUtcDay(now)
  const todayEnd = endOfUtcDay(now)

  if (preset === 'custom') return null
  if (preset === 'today') {
    return { from: toDateInputValue(todayStart), to: toDateInputValue(todayEnd) }
  }
  if (preset === 'yesterday') {
    const yesterday = addUtcDays(now, -1)
    return {
      from: toDateInputValue(startOfUtcDay(yesterday)),
      to: toDateInputValue(endOfUtcDay(yesterday)),
    }
  }
  if (preset === 'this_week') {
    return {
      from: toDateInputValue(startOfUtcWeek(now)),
      to: toDateInputValue(todayEnd),
    }
  }
  if (preset === 'last_week') {
    const thisWeek = startOfUtcWeek(now)
    return {
      from: toDateInputValue(addUtcDays(thisWeek, -7)),
      to: toDateInputValue(new Date(thisWeek.getTime() - 1)),
    }
  }
  if (preset === 'this_month') {
    return {
      from: toDateInputValue(startOfUtcMonth(now)),
      to: toDateInputValue(todayEnd),
    }
  }
  if (preset === 'last_month') {
    const thisMonth = startOfUtcMonth(now)
    const lastMonthStart = new Date(
      Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1),
    )
    return {
      from: toDateInputValue(lastMonthStart),
      to: toDateInputValue(new Date(thisMonth.getTime() - 1)),
    }
  }
  if (preset === 'last_90_days') {
    return {
      from: toDateInputValue(startOfUtcDay(addUtcDays(now, -89))),
      to: toDateInputValue(todayEnd),
    }
  }
  return {
    from: toDateInputValue(startOfUtcDay(addUtcDays(now, -29))),
    to: toDateInputValue(todayEnd),
  }
}

export function formatUtcRangeLabel(from: string, to: string) {
  if (!from && !to) return 'All time'
  return `${from || '…'} → ${to || '…'} (UTC)`
}
