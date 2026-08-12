import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CompanyRepository } from './company.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
  ) {}

  private normalizeOptional(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  async create(tenantId: string, userId: string, dto: CreateCompanyDto) {
    const existing = await this.companyRepository.findByNameAndTenant(
      dto.name.trim(),
      tenantId,
    );

    if (existing) {
      throw new ConflictException(
        'A company with this name already exists for your tenant.',
      );
    }

    return this.companyRepository.create({
      tenantId,
      userId,
      name: dto.name.trim(),
      domain: this.normalizeOptional(dto.domain) ?? undefined,
      website: this.normalizeOptional(dto.website) ?? undefined,
      industry: this.normalizeOptional(dto.industry) ?? undefined,
      description: this.normalizeOptional(dto.description) ?? undefined,
    });
  }

  async findAll(tenantId: string, search?: string) {
    return this.companyRepository.findAllByTenant(tenantId, search);
  }

  async findOne(tenantId: string, id: string) {
    const company = await this.companyRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(tenantId: string, id: string, dto: UpdateCompanyDto) {
    const existing = await this.companyRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    // If the name is being changed, check for duplicates
    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim();

      if (normalizedName.length === 0) {
        throw new ConflictException('Company name cannot be empty');
      }

      if (normalizedName !== existing.name) {
        const duplicate = await this.companyRepository.findByNameAndTenant(
          normalizedName,
          tenantId,
        );

        if (duplicate) {
          throw new ConflictException(
            'A company with this name already exists for your tenant.',
          );
        }
      }
    }

    return this.companyRepository.update(id, tenantId, {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      domain: this.normalizeOptional(dto.domain),
      website: this.normalizeOptional(dto.website),
      industry: this.normalizeOptional(dto.industry),
      description: this.normalizeOptional(dto.description),
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.companyRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const deleted = await this.companyRepository.delete(id, tenantId);

    if (!deleted) {
      throw new NotFoundException('Company not found');
    }

    return {
      message: 'Company deleted successfully',
      id,
    };
  }
}
