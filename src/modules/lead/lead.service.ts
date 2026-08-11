import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { companies } from '../../database/drizzle/schema';
import { LeadRepository, ListLeadsOptions } from './lead.repository';
import { CreateLeadDto, LeadStatus } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadService {
  constructor(
    private readonly leadRepository: LeadRepository,
  ) {}

  /**
   * Verify a company exists and belongs to the same tenant.
   * Throws BadRequestException if the company is not found or belongs to another tenant.
   */
  private async verifyCompanyOwnership(
    companyId: string,
    tenantId: string,
  ): Promise<void> {
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, companyId),
        eq(companies.tenantId, tenantId),
      ),
      columns: { id: true },
    });

    if (!company) {
      throw new BadRequestException(
        'Company not found or does not belong to your tenant.',
      );
    }
  }

  private normalizeOptional(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  async create(tenantId: string, dto: CreateLeadDto) {
    await this.verifyCompanyOwnership(dto.companyId, tenantId);

    return this.leadRepository.create({
      tenantId,
      companyId: dto.companyId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName?.trim(),
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      jobTitle: dto.jobTitle?.trim(),
      source: dto.source?.trim(),
      status: dto.status ?? LeadStatus.NEW,
      notes: dto.notes?.trim(),
    });
  }

  async findAll(
    tenantId: string,
    options: {
      status?: string;
      companyId?: string;
      source?: string;
      search?: string;
    },
  ) {
    return this.leadRepository.findAllByTenant(tenantId, options);
  }

  async findOne(tenantId: string, id: string) {
    const lead = await this.leadRepository.findByIdAndTenant(id, tenantId);

    if (!lead) {
      throw new NotFoundException('Lead not found.');
    }

    return lead;
  }

  async update(tenantId: string, id: string, dto: UpdateLeadDto) {
    const existing = await this.leadRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Lead not found.');
    }

    // If companyId is being changed, verify the new company belongs to this tenant
    if (dto.companyId !== undefined && dto.companyId !== existing.companyId) {
      await this.verifyCompanyOwnership(dto.companyId, tenantId);
    }

    return this.leadRepository.update(id, tenantId, {
      companyId: dto.companyId,
      firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
      lastName: this.normalizeOptional(dto.lastName),
      email:
        dto.email !== undefined
          ? (dto.email?.trim().toLowerCase() ?? null)
          : undefined,
      phone: this.normalizeOptional(dto.phone),
      jobTitle: this.normalizeOptional(dto.jobTitle),
      source: this.normalizeOptional(dto.source),
      status: dto.status,
      notes: this.normalizeOptional(dto.notes),
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.leadRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Lead not found.');
    }

    await this.leadRepository.delete(id, tenantId);

    return {
      message: 'Lead deleted successfully.',
      id,
    };
  }
}
