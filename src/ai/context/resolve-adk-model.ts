import type { ConfigService } from '@nestjs/config';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Resolves the Gemini model name for ADK agents.
 * Tenant master_settings.aiModel is preferred when provided; otherwise GEMINI_MODEL env.
 */
export function resolveAdkModelName(
  configService: ConfigService,
  tenantAiModel?: string | null,
): string {
  const tenantModel = tenantAiModel?.trim();
  if (tenantModel) {
    return tenantModel;
  }

  return configService.get<string>('GEMINI_MODEL', DEFAULT_GEMINI_MODEL);
}
