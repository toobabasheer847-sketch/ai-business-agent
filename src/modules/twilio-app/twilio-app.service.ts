import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TwilioAppRepository } from './twilio-app.repository';
import { CreateTwilioAppDto, TwilioAppStatus } from './dto/create-twilio-app.dto';
import { UpdateTwilioAppDto } from './dto/update-twilio-app.dto';
import { TwilioAppQueryDto } from './dto/twilio-app-query.dto';

@Injectable()
export class TwilioAppService {
  constructor(
    private readonly twilioAppRepository: TwilioAppRepository,
  ) {}

  private normalizeOptional(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private async verifyPhoneNumberOwnership(
    phoneNumberId: string,
    tenantId: string,
  ): Promise<void> {
    const phoneNumber =
      await this.twilioAppRepository.findPhoneNumberByIdAndTenant(
        phoneNumberId,
        tenantId,
      );

    if (!phoneNumber) {
      throw new BadRequestException(
        'Phone number not found or does not belong to your tenant.',
      );
    }
  }

  async create(tenantId: string, dto: CreateTwilioAppDto) {
    await this.verifyPhoneNumberOwnership(dto.phoneNumberId, tenantId);

    return this.twilioAppRepository.create({
      tenantId,
      phoneNumberId: dto.phoneNumberId,
      accountSid: dto.accountSid.trim(),
      authToken: dto.authToken.trim(),
      appSid: dto.appSid?.trim(),
      webhookUrl: dto.webhookUrl?.trim(),
      status: dto.status ?? TwilioAppStatus.ACTIVE,
    });
  }

  async findAll(tenantId: string, query: TwilioAppQueryDto) {
    return this.twilioAppRepository.findAllByTenant(tenantId, {
      phoneNumberId: query.phoneNumberId,
      status: query.status,
      search: query.search,
    });
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.twilioAppRepository.findByIdAndTenant(id, tenantId);

    if (!row) {
      throw new NotFoundException('Twilio App not found.');
    }

    return row;
  }

  async update(tenantId: string, id: string, dto: UpdateTwilioAppDto) {
    const existing = await this.twilioAppRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Twilio App not found.');
    }

    if (
      dto.phoneNumberId !== undefined &&
      dto.phoneNumberId !== existing.phoneNumberId
    ) {
      await this.verifyPhoneNumberOwnership(dto.phoneNumberId, tenantId);
    }

    return this.twilioAppRepository.update(id, tenantId, {
      phoneNumberId: dto.phoneNumberId,
      accountSid:
        dto.accountSid !== undefined ? dto.accountSid.trim() : undefined,
      authToken:
        dto.authToken !== undefined ? dto.authToken.trim() : undefined,
      appSid: this.normalizeOptional(dto.appSid),
      webhookUrl: this.normalizeOptional(dto.webhookUrl),
      status: dto.status,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.twilioAppRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Twilio App not found.');
    }

    await this.twilioAppRepository.delete(id, tenantId);

    return {
      message: 'Twilio App deleted successfully.',
      id,
    };
  }
}
