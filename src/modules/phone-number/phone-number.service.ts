import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AvailablePhoneNumbersService } from '../../integrations/twilio/available-phone-numbers';
import { TwilioAppConfigurationService } from '../../integrations/twilio/twilio-app-configuration';
import { PhoneNumberRepository } from './phone-number.repository';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';
import { UpdatePhoneNumberDto } from './dto/update-phone-number.dto';
import { PhoneNumberQueryDto } from './dto/phone-number-query.dto';
import { AvailablePhoneNumbersQueryDto } from './dto/available-phone-numbers-query.dto';
import { BuyPhoneNumberDto } from './dto/buy-phone-number.dto';
import { PhoneNumberProvider, PhoneNumberStatus } from './dto/create-phone-number.dto';
import type { PhoneNumber, PhoneNumberRow } from './entities/phone-number.entity';

@Injectable()
export class PhoneNumberService {
  constructor(
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly availablePhoneNumbersService: AvailablePhoneNumbersService,
    private readonly twilioConfigService: TwilioAppConfigurationService,
  ) {}

  /**
   * Strips authToken from every API response. Never log the token.
   */
  toPublic(row: PhoneNumberRow): PhoneNumber {
    return {
      id: row.id,
      tenantId: row.tenantId,
      phoneNumber: row.phoneNumber,
      label: row.label,
      provider: row.provider,
      status: row.status,
      phoneSid: row.phoneSid,
      twilioSid: row.twilioSid,
      appSid: row.appSid,
      webhookUrl: row.webhookUrl,
      hasAuthToken: Boolean(row.authToken),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private normalizeOptional(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  /**
   * Empty authToken on update means "keep current". Create treats empty as unset.
   */
  private normalizeAuthToken(
    value: string | undefined,
    mode: 'create' | 'update',
  ): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (!trimmed) {
      return mode === 'update' ? undefined : null;
    }
    return trimmed;
  }

  async create(tenantId: string, dto: CreatePhoneNumberDto) {
    const existing = await this.phoneNumberRepository.findByPhoneNumberAndTenant(
      dto.phoneNumber,
      tenantId,
    );

    if (existing) {
      throw new ConflictException(
        `Phone number ${dto.phoneNumber} is already registered for this tenant.`,
      );
    }

    const row = await this.phoneNumberRepository.create({
      tenantId,
      phoneNumber: dto.phoneNumber,
      label: dto.label?.trim(),
      provider: dto.provider,
      status: dto.status,
      phoneSid: this.normalizeOptional(dto.phoneSid),
      twilioSid: this.normalizeOptional(dto.twilioSid),
      authToken: this.normalizeAuthToken(dto.authToken, 'create'),
      appSid: this.normalizeOptional(dto.appSid),
      webhookUrl: this.normalizeOptional(dto.webhookUrl),
    });

    return this.toPublic(row);
  }

  async findAll(tenantId: string, query: PhoneNumberQueryDto) {
    const rows = await this.phoneNumberRepository.findAllByTenant(tenantId, {
      provider: query.provider,
      status: query.status,
      search: query.search,
    });

    return rows.map((row) => this.toPublic(row));
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.phoneNumberRepository.findByIdAndTenant(id, tenantId);

    if (!row) {
      throw new NotFoundException('Phone number not found.');
    }

    return this.toPublic(row);
  }

  async update(tenantId: string, id: string, dto: UpdatePhoneNumberDto) {
    const existing = await this.phoneNumberRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Phone number not found.');
    }

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

    const row = await this.phoneNumberRepository.update(id, tenantId, {
      phoneNumber: dto.phoneNumber,
      label: this.normalizeOptional(dto.label),
      provider: dto.provider,
      status: dto.status,
      phoneSid: this.normalizeOptional(dto.phoneSid),
      twilioSid: this.normalizeOptional(dto.twilioSid),
      authToken: this.normalizeAuthToken(dto.authToken, 'update'),
      appSid: this.normalizeOptional(dto.appSid),
      webhookUrl: this.normalizeOptional(dto.webhookUrl),
    });

    return this.toPublic(row!);
  }

  /**
   * Clears Twilio configuration on the row. Does not delete the phone number.
   */
  async disconnectTwilio(tenantId: string, id: string) {
    const existing = await this.phoneNumberRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Phone number not found.');
    }

    const row = await this.phoneNumberRepository.disconnectTwilio(id, tenantId);

    return this.toPublic(row!);
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

  /**
   * Search Twilio inventory for numbers available to purchase.
   * Credentials and Twilio calls stay in AvailablePhoneNumbersService.
   */
  async searchAvailable(tenantId: string, query: AvailablePhoneNumbersQueryDto) {
    return this.availablePhoneNumbersService.searchAvailable({
      tenantId,
      countryCode: query.countryCode?.trim() || 'US',
      locality: query.locality,
      areaCode: query.areaCode,
      contains: query.contains,
      type: query.type,
      limit: query.limit,
    });
  }

  /**
   * Purchase a Twilio number, then persist it for the authenticated tenant.
   * tenantId always comes from JWT (caller), never from the body.
   * Does not configure Twilio voice/SMS/status webhooks — those are set
   * manually on the Phone Number record when needed.
   *
   * Persists only values the purchase actually produced or used:
   * phoneSid, and the Account SID / Auth Token used to call Twilio (if resolved).
   * Does not invent appSid or webhookUrl.
   */
  async buy(tenantId: string, dto: BuyPhoneNumberDto) {
    const existing = await this.phoneNumberRepository.findByPhoneNumberAndTenant(
      dto.phoneNumber,
      tenantId,
    );

    if (existing) {
      throw new ConflictException(
        `Phone number ${dto.phoneNumber} is already registered for this tenant.`,
      );
    }

    const locationBits = [dto.locality, dto.region, dto.countryCode]
      .map((part) => part?.trim())
      .filter(Boolean);
    const friendlyName =
      dto.label?.trim() ||
      (locationBits.length > 0 ? locationBits.join(', ') : undefined);

    const purchased = await this.availablePhoneNumbersService.purchaseNumber({
      tenantId,
      phoneNumber: dto.phoneNumber,
      friendlyName,
    });

    const credentials =
      await this.twilioConfigService.resolveCredentialsForTenant(tenantId);

    const row = await this.phoneNumberRepository.create({
      tenantId,
      phoneNumber: purchased.phoneNumber,
      label: friendlyName,
      provider: PhoneNumberProvider.TWILIO,
      status: PhoneNumberStatus.ACTIVE,
      phoneSid: purchased.sid,
      twilioSid: credentials?.accountSid ?? null,
      authToken: credentials?.authToken ?? null,
    });

    return {
      ...this.toPublic(row),
      purchase: {
        sid: purchased.sid,
        status: purchased.status,
        friendlyName: purchased.friendlyName,
      },
    };
  }
}
