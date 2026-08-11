import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantRepository } from './tenant.repository';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    private readonly tenantRepository: TenantRepository,
  ) {}

  /**
   * Return the authenticated tenant. tenantId always comes from JWT.
   */
  async getAuthenticatedTenant(tenantId: string) {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return tenant;
  }

  /**
   * Update the authenticated tenant. Only schema-supported fields are editable.
   */
  async updateAuthenticatedTenant(tenantId: string, dto: UpdateTenantDto) {
    const existing = await this.tenantRepository.findById(tenantId);

    if (!existing) {
      throw new NotFoundException('Tenant not found.');
    }

    return this.tenantRepository.update(tenantId, {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
    });
  }
}
