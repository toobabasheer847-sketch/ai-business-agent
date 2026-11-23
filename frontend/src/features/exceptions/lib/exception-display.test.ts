import { describe, expect, it } from 'vitest'

import { availableActions, canManageException, exceptionLabel, relatedHref } from '@/features/exceptions/lib/exception-display'

describe('exception display', () => {
  it('labels categories and links each source to its existing page', () => {
    expect(exceptionLabel('ai_automation')).toBe('AI')
    expect(relatedHref('proposal')).toBe('/proposals')
    expect(relatedHref('ai_approval')).toBe('/approvals')
    expect(relatedHref('agent_run')).toBe('/ai-monitoring')
    expect(relatedHref('unknown')).toBeNull()
  })

  it('allows management only while the exception is open', () => {
    expect(canManageException('open')).toBe(true)
    expect(canManageException('resolved')).toBe(false)
    expect(canManageException('dismissed')).toBe(false)
  })

  it('hides actions the server would reject for the current status', () => {
    expect(availableActions('acknowledged').acknowledge).toBe(false)
    expect(availableActions('acknowledged').progress).toBe(true)
    expect(availableActions('in_progress').progress).toBe(false)
    expect(availableActions('resolved').resolve).toBe(false)
  })
})
