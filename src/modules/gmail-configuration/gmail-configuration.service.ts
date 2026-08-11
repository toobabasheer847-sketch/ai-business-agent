import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  GmailConfigurationRepository,
  type GmailConfigRow,
} from './gmail-configuration.repository';
import { CreateGmailConfigurationDto } from './dto/create-gmail-configuration.dto';
import { UpdateGmailConfigurationDto } from './dto/update-gmail-configuration.dto';
import type { GmailConfigurationSafe } from './entities/gmail-configuration.entity';

@Injectable()
export class GmailConfigurationService {
  constructor(
    private readonly gmailConfigRepository: GmailConfigurationRepository,
  ) {}

  /**
   * Strip sensitive fields before returning to the client.
   * clientSecret, accessToken, and refreshToken are NEVER exposed.
   */
  private toSafeResponse(row: GmailConfigRow): GmailConfigurationSafe {
    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      clientId: row.clientId,
      tokenExpiry: row.tokenExpiry,
      isActive: row.isActive,
      hasTokens: !!(row.accessToken || row.refreshToken),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private parseTokenExpiry(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (isNaN(d.getTime())) return undefined;
    return d;
  }

  async create(
    tenantId: string,
    dto: CreateGmailConfigurationDto,
  ): Promise<GmailConfigurationSafe> {
    const existing = await this.gmailConfigRepository.findByTenantId(tenantId);

    if (existing) {
      throw new ConflictException(
        'A Gmail configuration already exists for this tenant. Use PATCH to update it.',
      );
    }

    const row = await this.gmailConfigRepository.create({
      tenantId,
      email: dto.email.trim().toLowerCase(),
      clientId: dto.clientId?.trim(),
      clientSecret: dto.clientSecret?.trim(),
      accessToken: dto.accessToken?.trim(),
      refreshToken: dto.refreshToken?.trim(),
      tokenExpiry: this.parseTokenExpiry(dto.tokenExpiry),
      isActive: dto.isActive ?? true,
    });

    return this.toSafeResponse(row);
  }

  async findByTenant(tenantId: string): Promise<GmailConfigurationSafe> {
    const row = await this.gmailConfigRepository.findByTenantId(tenantId);

    if (!row) {
      throw new NotFoundException(
        'No Gmail configuration found for this tenant.',
      );
    }

    return this.toSafeResponse(row);
  }

  async update(
    tenantId: string,
    dto: UpdateGmailConfigurationDto,
  ): Promise<GmailConfigurationSafe> {
    const existing = await this.gmailConfigRepository.findByTenantId(tenantId);

    if (!existing) {
      throw new NotFoundException(
        'No Gmail configuration found for this tenant.',
      );
    }

    const row = await this.gmailConfigRepository.update(existing.id, tenantId, {
      email: dto.email?.trim().toLowerCase(),
      clientId: dto.clientId !== undefined ? (dto.clientId?.trim() ?? null) : undefined,
      clientSecret: dto.clientSecret !== undefined ? (dto.clientSecret?.trim() ?? null) : undefined,
      accessToken: dto.accessToken !== undefined ? (dto.accessToken?.trim() ?? null) : undefined,
      refreshToken: dto.refreshToken !== undefined ? (dto.refreshToken?.trim() ?? null) : undefined,
      tokenExpiry: dto.tokenExpiry !== undefined
        ? (this.parseTokenExpiry(dto.tokenExpiry) ?? null)
        : undefined,
      isActive: dto.isActive,
    });

    if (!row) {
      throw new NotFoundException(
        'No Gmail configuration found for this tenant.',
      );
    }

    return this.toSafeResponse(row);
  }

  async deactivate(tenantId: string): Promise<GmailConfigurationSafe> {
    const existing = await this.gmailConfigRepository.findByTenantId(tenantId);

    if (!existing) {
      throw new NotFoundException(
        'No Gmail configuration found for this tenant.',
      );
    }

    const row = await this.gmailConfigRepository.update(existing.id, tenantId, {
      isActive: false,
    });

    if (!row) {
      throw new NotFoundException(
        'No Gmail configuration found for this tenant.',
      );
    }

    return this.toSafeResponse(row);
  }

  async remove(tenantId: string): Promise<{ message: string }> {
    const existing = await this.gmailConfigRepository.findByTenantId(tenantId);

    if (!existing) {
      throw new NotFoundException(
        'No Gmail configuration found for this tenant.',
      );
    }

    await this.gmailConfigRepository.delete(existing.id, tenantId);

    return { message: 'Gmail configuration deleted successfully.' };
  }

  /**
   * Internal method — used by other services (e.g. AI communication agent tools)
   * to retrieve the full config row including tokens.
   * NEVER expose this via a controller endpoint.
   */
  async getFullConfigForInternal(
    tenantId: string,
  ): Promise<GmailConfigRow | null> {
    return (await this.gmailConfigRepository.findByTenantId(tenantId)) ?? null;
  }
}
