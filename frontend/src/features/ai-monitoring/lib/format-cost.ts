export function formatEstimatedCost(input: {
  totalRuns: number
  estimatedCost: string | null
  currency: string | null
  mixedCurrencies: boolean
  pricingNotConfiguredRuns: number
}) {
  if (input.totalRuns === 0) return 'No data'
  if (input.mixedCurrencies) return 'Multiple currencies'
  if (input.estimatedCost && input.currency) return `${trimDecimal(input.estimatedCost)} ${input.currency}`
  if (input.pricingNotConfiguredRuns > 0) return 'Pricing not configured'
  return 'Usage unavailable'
}

export function formatTokenCount(value: number | null) {
  if (value === null) return 'Unavailable'
  return new Intl.NumberFormat('en-US').format(value)
}

function trimDecimal(value: string) {
  if (!value.includes('.')) return value
  return value.replace(/0+$/, '').replace(/\.$/, '')
}
