import { NotFoundException } from '@nestjs/common';

import { ProspectService } from './prospect.service';

describe('ProspectService', () => {
  const prospectRepository = {
    findByIdAndTenant: jest.fn(),
    findCompanyByIdAndTenant: jest.fn(),
    findLeadByIdAndTenant: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const service = new ProspectService(prospectRepository as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a prospect only for the requesting tenant', async () => {
    prospectRepository.findByIdAndTenant.mockResolvedValue({
      id: 'prospect-1',
      tenantId: 'tenant-a',
      firstName: 'Ada',
    });

    const prospect = await service.findOne('tenant-a', 'prospect-1');

    expect(prospect.tenantId).toBe('tenant-a');
    expect(prospectRepository.findByIdAndTenant).toHaveBeenCalledWith(
      'prospect-1',
      'tenant-a',
    );
  });

  it('hides prospects from other tenants', async () => {
    prospectRepository.findByIdAndTenant.mockResolvedValue(undefined);

    await expect(service.findOne('tenant-b', 'prospect-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a prospect after tenant ownership checks', async () => {
    prospectRepository.findCompanyByIdAndTenant.mockResolvedValue({
      id: 'company-1',
      tenantId: 'tenant-a',
    });
    prospectRepository.findLeadByIdAndTenant.mockResolvedValue({
      id: 'lead-1',
      tenantId: 'tenant-a',
      companyId: 'company-1',
    });
    prospectRepository.create.mockResolvedValue({
      id: 'prospect-1',
      tenantId: 'tenant-a',
      companyId: 'company-1',
      leadId: 'lead-1',
      firstName: 'Ada',
    });

    const created = await service.create('tenant-a', {
      companyId: 'company-1',
      leadId: 'lead-1',
      firstName: 'Ada',
    });

    expect(created.tenantId).toBe('tenant-a');
    expect(prospectRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' }),
    );
  });
});
