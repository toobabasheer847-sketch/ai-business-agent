import { UnauthorizedException } from '@nestjs/common';

import { TaskCrmResolver } from './resolve-crm-entities';

describe('TaskCrmResolver', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  let companyRepository: {
    findAllByTenant: jest.Mock;
    findByIdAndTenant: jest.Mock;
  };
  let prospectRepository: {
    findAllByTenant: jest.Mock;
    findByIdAndTenant: jest.Mock;
  };
  let leadRepository: {
    findAllByTenant: jest.Mock;
    findByIdAndTenant: jest.Mock;
  };
  let resolver: TaskCrmResolver;

  beforeEach(() => {
    companyRepository = {
      findAllByTenant: jest.fn().mockResolvedValue([]),
      findByIdAndTenant: jest.fn().mockResolvedValue(undefined),
    };
    prospectRepository = {
      findAllByTenant: jest.fn().mockResolvedValue([]),
      findByIdAndTenant: jest.fn().mockResolvedValue(undefined),
    };
    leadRepository = {
      findAllByTenant: jest.fn().mockResolvedValue([]),
      findByIdAndTenant: jest.fn().mockResolvedValue(undefined),
    };
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
    expect(companyRepository.findAllByTenant).toHaveBeenCalledWith(
      tenantA,
      'Ahmed',
    );
  });

  it('resolves a unique company when follow-up text names it without the company keyword', async () => {
    companyRepository.findAllByTenant.mockResolvedValue([
      { id: 'c1', tenantId: tenantA, name: 'ABC Technologies' },
    ]);

    await expect(
      resolver.resolve(
        { personQuery: 'ABC', explicitCompany: false },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'resolved',
      company: { kind: 'company', id: 'c1', name: 'ABC Technologies' },
    });
  });

  it('asks for clarification when follow-up text matches multiple companies', async () => {
    companyRepository.findAllByTenant.mockResolvedValue([
      { id: 'c1', tenantId: tenantA, name: 'ABC Solutions' },
      { id: 'c2', tenantId: tenantA, name: 'ABC Technologies' },
    ]);

    await expect(
      resolver.resolve(
        { personQuery: 'ABC', explicitCompany: false },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'ambiguous',
      kind: 'company',
      query: 'ABC',
      matches: ['ABC Solutions', 'ABC Technologies'],
    });
  });

  it('does not treat a company token in an email domain as a person match', async () => {
    leadRepository.findAllByTenant.mockResolvedValue([
      {
        id: 'l1',
        tenantId: tenantA,
        firstName: 'Ahmed',
        lastName: 'Khan',
        email: 'ahmed@nimbusforge.test',
        companyId: 'c1',
      },
    ]);
    companyRepository.findAllByTenant.mockResolvedValue([
      { id: 'c1', tenantId: tenantA, name: 'NimbusForge' },
    ]);

    await expect(
      resolver.resolve(
        { personQuery: 'NimbusForge', explicitCompany: false },
        tenantA,
      ),
    ).resolves.toEqual({
      status: 'resolved',
      company: { kind: 'company', id: 'c1', name: 'NimbusForge' },
    });
  });

  it('requires a tenant id', async () => {
    await expect(
      resolver.resolve({ companyQuery: 'ABC', explicitCompany: true }, ''),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts same-tenant CRM ids', async () => {
    companyRepository.findByIdAndTenant.mockResolvedValue({
      id: 'c1',
      tenantId: tenantA,
    });
    prospectRepository.findByIdAndTenant.mockResolvedValue({
      id: 'p1',
      tenantId: tenantA,
    });
    leadRepository.findByIdAndTenant.mockResolvedValue({
      id: 'l1',
      tenantId: tenantA,
    });

    await expect(
      resolver.assertIds(tenantA, {
        companyId: 'c1',
        prospectId: 'p1',
        leadId: 'l1',
      }),
    ).resolves.toEqual({
      companyId: 'c1',
      prospectId: 'p1',
      leadId: 'l1',
    });
  });

  it('rejects a cross-tenant company id', async () => {
    companyRepository.findByIdAndTenant.mockResolvedValue(undefined);

    await expect(
      resolver.assertIds(tenantA, { companyId: 'c-b' }),
    ).rejects.toThrow('Company not found or does not belong to your tenant.');
    expect(companyRepository.findByIdAndTenant).toHaveBeenCalledWith(
      'c-b',
      tenantA,
    );
  });

  it('rejects a cross-tenant prospect id', async () => {
    prospectRepository.findByIdAndTenant.mockResolvedValue(undefined);

    await expect(
      resolver.assertIds(tenantA, { prospectId: 'p-b' }),
    ).rejects.toThrow('Prospect not found or does not belong to your tenant.');
  });

  it('rejects a cross-tenant lead id', async () => {
    leadRepository.findByIdAndTenant.mockResolvedValue(undefined);

    await expect(
      resolver.assertIds(tenantA, { leadId: 'l-b' }),
    ).rejects.toThrow('Lead not found or does not belong to your tenant.');
  });

  it('allows tasks with no CRM ids', async () => {
    await expect(resolver.assertIds(tenantA, {})).resolves.toEqual({
      companyId: undefined,
      prospectId: undefined,
      leadId: undefined,
    });
    expect(companyRepository.findByIdAndTenant).not.toHaveBeenCalled();
  });
});
