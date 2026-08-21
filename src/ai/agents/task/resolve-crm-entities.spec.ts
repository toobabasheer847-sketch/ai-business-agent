import { UnauthorizedException } from '@nestjs/common';

import { TaskCrmResolver } from './resolve-crm-entities';

describe('TaskCrmResolver', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  let companyRepository: { findAllByTenant: jest.Mock };
  let prospectRepository: { findAllByTenant: jest.Mock };
  let leadRepository: { findAllByTenant: jest.Mock };
  let resolver: TaskCrmResolver;

  beforeEach(() => {
    companyRepository = { findAllByTenant: jest.fn().mockResolvedValue([]) };
    prospectRepository = { findAllByTenant: jest.fn().mockResolvedValue([]) };
    leadRepository = { findAllByTenant: jest.fn().mockResolvedValue([]) };
    resolver = new TaskCrmResolver(
      companyRepository as any,
      prospectRepository as any,
      leadRepository as any,
    );
  });

  it('returns none when there are no CRM hints', async () => {
    await expect(
      resolver.resolve({ explicitCompany: false }, tenantA),
    ).resolves.toEqual({ status: 'none' });
    expect(companyRepository.findAllByTenant).not.toHaveBeenCalled();
  });

  it('resolves a unique company in the current tenant', async () => {
    companyRepository.findAllByTenant.mockResolvedValue([
      { id: 'c1', tenantId: tenantA, name: 'ABC Technologies' },
    ]);

    await expect(
      resolver.resolve(
        { companyQuery: 'ABC', explicitCompany: true },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'resolved',
      company: { kind: 'company', id: 'c1', name: 'ABC Technologies' },
    });
    expect(companyRepository.findAllByTenant).toHaveBeenCalledWith(
      tenantA,
      'ABC',
    );
  });

  it('does not invent a company when the tenant has no match', async () => {
    await expect(
      resolver.resolve(
        { companyQuery: 'ABC', explicitCompany: true },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'missing',
      kind: 'company',
      query: 'ABC',
    });
    expect(companyRepository.findAllByTenant).not.toHaveBeenCalledWith(
      tenantB,
      expect.anything(),
    );
  });

  it('does not choose among multiple companies', async () => {
    companyRepository.findAllByTenant.mockResolvedValue([
      { id: 'c1', tenantId: tenantA, name: 'ABC Solutions' },
      { id: 'c2', tenantId: tenantA, name: 'ABC Technologies' },
    ]);

    await expect(
      resolver.resolve(
        { companyQuery: 'ABC', explicitCompany: true },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'ambiguous',
      kind: 'company',
      query: 'ABC',
      matches: ['ABC Solutions', 'ABC Technologies'],
    });
  });

  it('ignores a company row that belongs to another tenant', async () => {
    companyRepository.findAllByTenant.mockResolvedValue([
      { id: 'c-b', tenantId: tenantB, name: 'ABC Technologies' },
    ]);

    await expect(
      resolver.resolve(
        { companyQuery: 'ABC', explicitCompany: true },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'missing',
      kind: 'company',
      query: 'ABC',
    });
  });

  it('resolves a unique lead by email in the current tenant', async () => {
    leadRepository.findAllByTenant.mockResolvedValue([
      {
        id: 'l1',
        tenantId: tenantA,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        companyId: 'c1',
      },
    ]);

    await expect(
      resolver.resolve(
        { emailQuery: 'john@example.com', explicitCompany: false },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'resolved',
      person: {
        kind: 'lead',
        id: 'l1',
        name: 'John Smith',
        email: 'john@example.com',
        companyId: 'c1',
      },
    });
    expect(leadRepository.findAllByTenant).toHaveBeenCalledWith(tenantA, {
      search: 'john@example.com',
    });
  });

  it('does not guess when multiple prospects match', async () => {
    prospectRepository.findAllByTenant.mockResolvedValue([
      {
        id: 'p1',
        tenantId: tenantA,
        firstName: 'Ahmed',
        lastName: 'Khan',
        email: null,
      },
      {
        id: 'p2',
        tenantId: tenantA,
        firstName: 'Ahmed',
        lastName: 'Ali',
        email: null,
      },
    ]);

    await expect(
      resolver.resolve(
        { personQuery: 'Ahmed', explicitCompany: false },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'ambiguous',
      kind: 'person',
      query: 'Ahmed',
      matches: ['Ahmed Khan', 'Ahmed Ali'],
    });
  });

  it('returns none-style resolved person absence without creating records', async () => {
    const result = await resolver.resolve(
      { personQuery: 'Ahmed', explicitCompany: false },
      tenantA,
    );

    expect(result).toEqual({ status: 'resolved', person: undefined });
    expect(companyRepository.findAllByTenant).not.toHaveBeenCalled();
  });

  it('requires a tenant id', async () => {
    await expect(
      resolver.resolve({ companyQuery: 'ABC', explicitCompany: true }, ''),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
