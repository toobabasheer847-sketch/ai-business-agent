import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ProspectRepository } from './prospect.repository';
import { CreateProspectDto, ProspectStatus } from './dto/create-prospect.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { ProspectQueryDto } from './dto/prospect-query.dto';

@Injectable()
export class ProspectService {
  constructor(
    private readonly prospectRepository: ProspectRepository,
  ) {}

  private normalizeOptional(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  /**
   * Ensure company and lead exist for this tenant, and that the lead
   * is associated with the given company.
   */
  private async verifyCompanyAndLead(
    tenantId: string,
    companyId: string,
    leadId: string,
  ): Promise<void> {
    const company = await this.prospectRepository.findCompanyByIdAndTenant(
      companyId,
      tenantId,
    );

    if (!company) {
      throw new BadRequestException(
        'Company not found or does not belong to your tenant.',
      );
    }

    const lead = await this.prospectRepository.findLeadByIdAndTenant(
      leadId,
      tenantId,
    );

    if (!lead) {
      throw new BadRequestException(
        'Lead not found or does not belong to your tenant.',
      );
    }

    if (lead.companyId !== companyId) {
      throw new BadRequestException(
        'Lead does not belong to the specified company.',
      );
    }
  }

  async create(tenantId: string, dto: CreateProspectDto) {
    await this.verifyCompanyAndLead(tenantId, dto.companyId, dto.leadId);

    return this.prospectRepository.create({
      tenantId,
      companyId: dto.companyId,
      leadId: dto.leadId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName?.trim(),
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      jobTitle: dto.jobTitle?.trim(),
      status: dto.status ?? ProspectStatus.NEW,
      notes: dto.notes?.trim(),
    });
  }

  async findAll(tenantId: string, query: ProspectQueryDto) {
    return this.prospectRepository.findAllByTenant(tenantId, {
      status: query.status,
      companyId: query.companyId,
      leadId: query.leadId,
      search: query.search,
    });
  }

  async findOne(tenantId: string, id: string) {
    const prospect = await this.prospectRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!prospect) {
      throw new NotFoundException('Prospect not found.');
    }

    return prospect;
  }

  async update(tenantId: string, id: string, dto: UpdateProspectDto) {
    const existing = await this.prospectRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Prospect not found.');
    }

    const nextCompanyId = dto.companyId ?? existing.companyId;
    const nextLeadId = dto.leadId ?? existing.leadId;

    if (
      dto.companyId !== undefined ||
      dto.leadId !== undefined
    ) {
      await this.verifyCompanyAndLead(tenantId, nextCompanyId, nextLeadId);
    }

    return this.prospectRepository.update(id, tenantId, {
      companyId: dto.companyId,
      leadId: dto.leadId,
      firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
      lastName: this.normalizeOptional(dto.lastName),
      email:
        dto.email !== undefined
          ? (dto.email?.trim().toLowerCase() ?? null)
          : undefined,
      phone: this.normalizeOptional(dto.phone),
      jobTitle: this.normalizeOptional(dto.jobTitle),
      status: dto.status,
      notes: this.normalizeOptional(dto.notes),
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prospectRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Prospect not found.');
    }

    await this.prospectRepository.delete(id, tenantId);

    return {
      message: 'Prospect deleted successfully.',
      id,
    };
  }
}
