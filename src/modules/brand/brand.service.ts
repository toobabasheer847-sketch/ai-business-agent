import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BrandRepository } from './brand.repository';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepository: BrandRepository,
  ) {}

  private normalizeOptional(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  async create(tenantId: string, dto: CreateBrandDto) {
    const existing = await this.brandRepository.findByTenantId(tenantId);

    if (existing) {
      throw new ConflictException(
        'Tenant already has a brand. Only one brand per tenant is allowed.',
      );
    }

    return this.brandRepository.create({
      tenantId,
      name: dto.name.trim(),
      logoUrl: this.normalizeOptional(dto.logoUrl) ?? undefined,
      domain: this.normalizeOptional(dto.domain) ?? undefined,
      apiUrl: this.normalizeOptional(dto.apiUrl) ?? undefined,
      phone: this.normalizeOptional(dto.phone) ?? undefined,
    });
  }

  async findAll(tenantId: string) {
    const brand = await this.brandRepository.findByTenantId(tenantId);
    return brand ? [brand] : [];
  }

  async findOne(tenantId: string, id: string) {
    const brand = await this.brandRepository.findByIdAndTenant(id, tenantId);

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateBrandDto,
  ) {
    const existing = await this.brandRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Brand not found');
    }

    const normalizedName =
      dto.name !== undefined && dto.name !== null ? dto.name.trim() : undefined;

    if (normalizedName !== undefined && normalizedName.length === 0) {
      throw new ConflictException('Brand name cannot be empty');
    }

    return this.brandRepository.update(id, tenantId, {
      name: normalizedName,
      logoUrl: this.normalizeOptional(dto.logoUrl),
      domain: this.normalizeOptional(dto.domain),
      apiUrl: this.normalizeOptional(dto.apiUrl),
      phone: this.normalizeOptional(dto.phone),
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.brandRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Brand not found');
    }

    const deleted = await this.brandRepository.delete(id, tenantId);

    if (!deleted) {
      throw new NotFoundException('Brand not found');
    }

    return {
      message: 'Brand deleted successfully',
      id,
    };
  }
}
