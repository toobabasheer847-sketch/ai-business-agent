import { describe, expect, it } from 'vitest'

import { formatEstimatedCost, formatTokenCount } from '@/features/ai-monitoring/lib/format-cost'

describe('AI monitoring display', () => {
  it('does not present missing pricing as zero', () => {
    expect(formatEstimatedCost({
      totalRuns: 2,
      estimatedCost: null,
      currency: null,
      mixedCurrencies: false,
      pricingNotConfiguredRuns: 2,
    })).toBe('Pricing not configured')
  })

  it('shows an estimated amount only when the API returns one', () => {
    expect(formatEstimatedCost({
      totalRuns: 1,
      estimatedCost: '1.50000000',
      currency: 'USD',
      mixedCurrencies: false,
      pricingNotConfiguredRuns: 0,
    })).toBe('1.5 USD')
  })

  it('labels missing token counts', () => {
    expect(formatTokenCount(null)).toBe('Unavailable')
    expect(formatTokenCount(1200)).toBe('1,200')
  })
})
