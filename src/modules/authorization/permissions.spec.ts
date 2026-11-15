import { ForbiddenException } from '@nestjs/common';

import { AuthorizationService } from './authorization.service';
import { hasPermission, Permission } from './permissions';

describe('role permissions', () => {
  it('gives the owner tenant management and role changes', () => {
    expect(hasPermission('owner', Permission.TenantManage)).toBe(true);
    expect(hasPermission('owner', Permission.TeamChangeRole)).toBe(true);
    expect(hasPermission('owner', Permission.AuditView)).toBe(true);
  });

  it('keeps tenant settings and role changes away from admins', () => {
    expect(hasPermission('admin', Permission.CompanyDelete)).toBe(true);
    expect(hasPermission('admin', Permission.ProposalSend)).toBe(true);
    expect(hasPermission('admin', Permission.TeamManage)).toBe(true);
    expect(hasPermission('admin', Permission.TenantManage)).toBe(false);
    expect(hasPermission('admin', Permission.TeamChangeRole)).toBe(false);
  });

  it('limits members to their own tasks, companies, and assistant access', () => {
    expect(hasPermission('member', Permission.DashboardView)).toBe(true);
    expect(hasPermission('member', Permission.TaskViewOwn)).toBe(true);
    expect(hasPermission('member', Permission.TaskViewAll)).toBe(false);
    expect(hasPermission('member', Permission.TaskDelete)).toBe(false);
    expect(hasPermission('member', Permission.ProposalSend)).toBe(false);
    expect(hasPermission('member', Permission.AnalyticsView)).toBe(false);
    expect(hasPermission('member', Permission.TeamInsightsView)).toBe(false);
    expect(hasPermission('member', Permission.KnowledgeManage)).toBe(false);
    expect(hasPermission('missing', Permission.DashboardView)).toBe(false);
  });
});

describe('role assignment rules', () => {
  const db = {
    select: jest.fn(),
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
  };
  const service = new AuthorizationService(db as never);
  const owner = { userId: 'owner-1', tenantId: 'tenant-a', email: 'o@example.com', name: 'Owner', role: 'owner' };
  const admin = { ...owner, userId: 'admin-1', role: 'admin' };

  it('rejects an admin role change and a cross-tenant change', async () => {
    await expect(service.assertRoleAssignment(admin, { id: 'member-1', tenantId: 'tenant-a', role: 'member' }, 'admin', undefined))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertRoleAssignment(owner, { id: 'member-1', tenantId: 'tenant-b', role: 'member' }, 'admin', undefined))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects demoting the last active owner', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ total: 1 }]),
      }),
    });
    await expect(service.assertRoleAssignment(owner, { id: 'owner-2', tenantId: 'tenant-a', role: 'owner' }, 'admin', undefined))
      .rejects.toThrow('at least one active owner');
  });

  it('rejects an admin changing or removing an owner', async () => {
    await expect(service.assertRoleAssignment(admin, { id: 'owner-1', tenantId: 'tenant-a', role: 'owner' }, undefined, undefined))
      .rejects.toThrow('cannot change an owner');
    await expect(service.assertCanRemove(admin, { id: 'owner-1', tenantId: 'tenant-a', role: 'owner' }))
      .rejects.toThrow('Only an owner can remove an owner.');
  });

  it('lets the owner assign an admin when another owner remains', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ total: 2 }]),
      }),
    });
    await expect(service.assertRoleAssignment(owner, { id: 'owner-2', tenantId: 'tenant-a', role: 'owner' }, 'admin', undefined))
      .resolves.toBeUndefined();
  });

  it('rejects a user changing their own role', async () => {
    await expect(service.assertRoleAssignment(owner, { id: 'owner-1', tenantId: 'tenant-a', role: 'owner' }, 'admin', undefined))
      .rejects.toThrow('You cannot change your own role.');
    await expect(service.assertRoleAssignment(admin, { id: 'admin-1', tenantId: 'tenant-a', role: 'admin' }, 'owner', undefined))
      .rejects.toThrow('You cannot change your own role.');
  });

  it('defaults new users to member and blocks non-owners from assigning privileged roles', () => {
    expect(service.assertCreatableRole(admin, undefined)).toBe('member');
    expect(service.assertCreatableRole(owner, 'member')).toBe('member');
    expect(service.assertCreatableRole(owner, 'admin')).toBe('admin');
    expect(() => service.assertCreatableRole(admin, 'owner')).toThrow(ForbiddenException);
    expect(() => service.assertCreatableRole(admin, 'admin')).toThrow(ForbiddenException);
    expect(() => service.assertCreatableRole({ ...admin, role: 'member' }, 'admin')).toThrow(ForbiddenException);
  });
});
