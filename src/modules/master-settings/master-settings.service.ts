import { BadRequestException, Injectable } from '@nestjs/common';

import { isAllowedAiModel } from '../../ai/context/allowed-ai-models';
import { MasterSettingsRepository } from './master-settings.repository';
import { UpdateMasterSettingsDto } from './dto/update-master-settings.dto';

@Injectable()
export class MasterSettingsService {
  constructor(
    private readonly masterSettingsRepository: MasterSettingsRepository,
  ) {}

  /**
   * Get the tenant's master settings.
   * If no settings record exists yet, one is created with all defaults.
   * This makes the GET endpoint safe to call at any time — no manual creation needed.
   */
  async getOrCreate(tenantId: string) {
    const existing = await this.masterSettingsRepository.findByTenantId(tenantId);

    if (existing) {
      return existing;
    }

    return this.masterSettingsRepository.create(tenantId);
  }

  /**
   * Update the tenant's master settings.
   * Auto-creates default settings first if none exist.
   * Validates business hours ordering.
   */
  async update(tenantId: string, dto: UpdateMasterSettingsDto) {
    // Validate business hours: start must be before end
    if (
      dto.businessHoursStart !== undefined &&
      dto.businessHoursEnd !== undefined &&
      dto.businessHoursStart >= dto.businessHoursEnd
    ) {
      throw new BadRequestException(
        'businessHoursStart must be less than businessHoursEnd.',
      );
    }

    if (
      dto.aiModel !== undefined &&
      dto.aiModel !== null &&
      !isAllowedAiModel(dto.aiModel)
    ) {
      throw new BadRequestException(
        'aiModel is not in the allowlisted set of Gemini models.',
      );
    }

    // Auto-create default settings if they don't exist yet
    const existing = await this.masterSettingsRepository.findByTenantId(tenantId);

    if (!existing) {
      await this.masterSettingsRepository.create(tenantId);
    }

    const row = await this.masterSettingsRepository.update(tenantId, {
      defaultLanguage: dto.defaultLanguage?.trim(),
      defaultTimezone: dto.defaultTimezone?.trim(),
      defaultCurrency: dto.defaultCurrency?.trim().toUpperCase(),
      aiModel: dto.aiModel !== undefined
        ? (dto.aiModel === null ? null : dto.aiModel.trim())
        : undefined,
      maxConversationHistory: dto.maxConversationHistory,
      enableNotifications: dto.enableNotifications,
      notificationEmail: dto.notificationEmail !== undefined
        ? (dto.notificationEmail === null ? null : dto.notificationEmail.trim().toLowerCase())
        : undefined,
      businessHoursStart: dto.businessHoursStart,
      businessHoursEnd: dto.businessHoursEnd,
      isActive: dto.isActive,
    });

    return row;
  }
}
