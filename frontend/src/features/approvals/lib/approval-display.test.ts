import { describe, expect, it } from 'vitest'

import { approvalStatusClass, approvalStatusLabel, editableFields, needsHighRiskConfirmation } from '@/features/approvals/lib/approval-display'

describe('approval display', () => {
  it('keeps pending, executed, failed, rejected and expired distinct', () => {
    expect(['pending', 'executed', 'failed', 'rejected', 'expired'].map(approvalStatusLabel)).toEqual([
      'Pending',
      'Executed',
      'Failed',
      'Rejected',
      'Expired',
    ])
  })

  it('allows edits only for email and sms content', () => {
    expect(editableFields('email.send')).toEqual(['subject', 'body'])
    expect(editableFields('company.delete')).toEqual([])
    expect(editableFields('proposal.send')).toEqual([])
  })

  it('gives pending, executed, failed, rejected and expired different styles', () => {
    const styles = ['pending', 'executed', 'failed', 'rejected', 'expired'].map(approvalStatusClass)
    expect(new Set(styles).size).toBe(styles.length)
  })

  it('asks for confirmation before a high-risk approval', () => {
    expect(needsHighRiskConfirmation('high')).toBe(true)
    expect(needsHighRiskConfirmation('low')).toBe(false)
  })
})
