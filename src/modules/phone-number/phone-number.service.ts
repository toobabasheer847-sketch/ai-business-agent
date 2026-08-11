import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PhoneNumberRepository } from './phone-number.repository';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';
import { UpdatePhoneNumberDto } from './dto/update-phone-number.dto';
import { PhoneNumberQueryDto } from './dto/phone-number-query.dto';

@Injectable()
export class PhoneNumberService {
  constructor(
    private readonly phoneNumberRepository: PhoneNumberRepository,
  ) {}

  private normalizeOptional(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  async create(tenantId: string, dto: CreatePhoneNumberDto) {
    // Enforce uniqueness per tenant — same phone number cannot be registered twice
    const existing = await this.phoneNumberRepository.findByPhoneNumberAndTenant(
      dto.phoneNumber,
      tenantId,
    );

    if (existing) {
      throw new ConflictException(
        `Phone number ${dto.phoneNumber} is already registered for this tenant.`,
      );
    }

    return this.phoneNumberRepository.create({
      tenantId,
      phoneNumber: dto.phoneNumber,
      label: dto.label?.trim(),
      provider: dto.provider,
      status: dto.status,
      description: dto.description?.trim(),
    });
  }

  async findAll(tenantId: string, query: PhoneNumberQueryDto) {
    return this.phoneNumberRepository.findAllByTenant(tenantId, {
      provider: query.provider,
      status: query.status,
      search: query.search,
    });
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.phoneNumberRepository.findByIdAndTenant(id, tenantId);

    if (!row) {
      throw new NotFoundException('Phone number not found.');
    }

    return row;
  }

  async update(tenantId: string, id: string, dto: UpdatePhoneNumberDto) {
    const existing = await this.phoneNumberRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Phone number not found.');
    }

    // If phoneNumber is changing, check for duplicates
    if (dto.phoneNumber !== undefined && dto.phoneNumber !== existing.phoneNumber) {
      const duplicate = await this.phoneNumberRepository.findByPhoneNumberAndTenant(
        dto.phoneNumber,
        tenantId,
      );

      if (duplicate) {
        throw new ConflictException(
          `Phone number ${dto.phoneNumber} is already registered for this tenant.`,
        );
      }
    }

    return this.phoneNumberRepository.update(id, tenantId, {
      phoneNumber: dto.phoneNumber,
      label: this.normalizeOptional(dto.label),
      provider: dto.provider,
      status: dto.status,
      description: this.normalizeOptional(dto.description),
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.phoneNumberRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Phone number not found.');
    }

    await this.phoneNumberRepository.delete(id, tenantId);

    return {
      message: 'Phone number deleted successfully.',
      id,
    };
  }
}
