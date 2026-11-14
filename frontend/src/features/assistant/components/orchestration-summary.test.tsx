import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AssistantMessageList } from '@/features/assistant/components/assistant-message-list'
import { OrchestrationSummary } from '@/features/assistant/components/orchestration-summary'
import type { AssistantMessage, AssistantOrchestration } from '@/features/assistant/types/assistant.types'

const orchestration: AssistantOrchestration = {
  id: 'orch-1',
  status: 'partial',
  detectedIntents: ['company.create', 'lead.create', 'proposal.create', 'task.create'],
  clarification: null,
  operations: [
    { operationId: 'op-1', agent: 'crm', action: 'company.create', status: 'completed', summary: 'Created company ABC Technologies.' },
    { operationId: 'op-2', agent: 'crm', action: 'lead.create', status: 'completed', summary: 'Created lead Jane Doe.' },
    { operationId: 'op-3', agent: 'proposal', action: 'proposal.create', status: 'failed', summary: 'Proposal draft could not be saved.' },
    { operationId: 'op-4', agent: 'task', action: 'task.create', status: 'skipped', summary: 'Skipped because an earlier step did not complete.' },
  ],
}

afterEach(() => {
  cleanup()
})

describe('OrchestrationSummary', () => {
  it('shows completed, failed, and skipped operations', () => {
    render(<OrchestrationSummary orchestration={orchestration} />)
    expect(screen.getByText('company.create')).toBeTruthy()
    expect(screen.getAllByText('Completed').length).toBe(2)
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.getByText('Skipped')).toBeTruthy()
    expect(screen.getByText('Proposal draft could not be saved.')).toBeTruthy()
  })

  it('shows a clarification and does not offer confirmation', () => {
    render(
      <OrchestrationSummary
        orchestration={{
          ...orchestration,
          status: 'awaiting_clarification',
          clarification: "What is the person's name?",
          operations: [],
        }}
      />,
    )
    expect(screen.getByText("What is the person's name?")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
  })

  it('asks for confirmation before a sensitive action', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <OrchestrationSummary
        orchestration={{
          ...orchestration,
          status: 'awaiting_confirmation',
          operations: [
            { operationId: 'op-1', agent: 'proposal', action: 'proposal.send', status: 'awaiting_confirmation', summary: 'Sending the proposal needs your confirmation.' },
          ],
        }}
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByText('Awaiting confirmation')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledWith('orch-1')
  })

  it('keeps the summary readable in light and dark wrappers', () => {
    const { unmount } = render(
      <div>
        <OrchestrationSummary orchestration={orchestration} />
      </div>,
    )
    expect(screen.getByTestId('orchestration-summary')).toBeTruthy()
    unmount()
    render(
      <div className="dark">
        <OrchestrationSummary orchestration={orchestration} />
      </div>,
    )
    expect(document.querySelector('.dark')).toBeTruthy()
    expect(screen.getByText('Execution summary')).toBeTruthy()
  })
})

describe('AssistantMessageList orchestration states', () => {
  it('shows the planning state while a reply is pending', () => {
    const messages: AssistantMessage[] = [
      { id: 'a', role: 'assistant', content: '', createdAt: 1, pending: true },
    ]
    render(<AssistantMessageList messages={messages} bottomRef={{ current: null }} />)
    expect(screen.getByText('Understanding your request…')).toBeTruthy()
  })

  it('shows an error reply that can be retried by the surrounding page', () => {
    const messages: AssistantMessage[] = [
      { id: 'a', role: 'assistant', content: 'The assistant could not finish that request.', createdAt: 1, error: true },
    ]
    render(<AssistantMessageList messages={messages} bottomRef={{ current: null }} />)
    expect(screen.getByText('The assistant could not finish that request.')).toBeTruthy()
  })
})
