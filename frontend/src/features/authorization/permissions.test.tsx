import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { Permit } from '@/app/router/guards'
import { AccessDeniedPage } from '@/features/authorization/access-denied-page'
import { hasPermission, Permission } from '@/features/authorization/permissions'
import { mainNav } from '@/lib/constants/navigation'

const auth = {
  user: null as { role?: 'owner' | 'admin' | 'member' } | null,
  isBootstrapping: false,
  isAuthenticated: true,
}

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => auth,
}))

function visibleHrefs(role: 'owner' | 'admin' | 'member') {
  return mainNav
    .filter((item) => !item.permissions?.length || item.permissions.some((permission) => hasPermission(role, permission)))
    .map((item) => item.href)
}

describe('role permissions', () => {
  afterEach(() => cleanup())

  it('shows operational navigation to every role and hides owner settings from members', () => {
    expect(visibleHrefs('member')).toContain('/dashboard')
    expect(visibleHrefs('member')).toContain('/analytics')
    expect(visibleHrefs('member')).not.toContain('/knowledgebases')
    expect(visibleHrefs('member')).not.toContain('/tenant')
    expect(visibleHrefs('member')).not.toContain('/master-settings')
    expect(visibleHrefs('admin')).not.toContain('/tenant')
    expect(visibleHrefs('member')).not.toContain('/gmail-configuration')
    expect(visibleHrefs('admin')).not.toContain('/master-settings')
    expect(visibleHrefs('owner')).toContain('/tenant')
    expect(visibleHrefs('owner')).toContain('/master-settings')
    expect(hasPermission('member', Permission.ProposalSend)).toBe(false)
    expect(hasPermission('admin', Permission.ProposalSend)).toBe(true)
    expect(hasPermission('owner', Permission.TenantManage)).toBe(true)
  })

  it('keeps restricted navigation hidden while permissions are still loading', () => {
    auth.isBootstrapping = true
    auth.user = null
    render(
      <MemoryRouter initialEntries={['/knowledgebases']}>
        <Routes>
          <Route path="/knowledgebases" element={<Permit permissions={[Permission.KnowledgeManage]}><p>Knowledge</p></Permit>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Knowledge')).toBeNull()
    expect(screen.queryByText('Access denied')).toBeNull()
    auth.isBootstrapping = false
  })

  it('shows access denied when a member opens an owner route', () => {
    auth.user = { role: 'member' }
    auth.isBootstrapping = false
    render(
      <MemoryRouter initialEntries={['/knowledgebases']}>
        <Routes>
          <Route path="/knowledgebases" element={<Permit permissions={[Permission.KnowledgeManage]}><p>Knowledge</p></Permit>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeTruthy()
    expect(screen.queryByText('Knowledge')).toBeNull()
  })

  it('renders the access denied page with a way back to the dashboard', () => {
    render(
      <MemoryRouter>
        <AccessDeniedPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Back to dashboard' }).getAttribute('href')).toBe('/dashboard')
  })
})
