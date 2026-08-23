import type { ConfigService } from '@nestjs/config';

import { getTrustedAiContext } from './ai-request-context.js';
import { isAllowedAiModel } from './allowed-ai-models.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Resolves the Gemini model name for ADK agents.
 *
 * Priority:
 * 1. Tenant master_settings.aiModel when present AND allowlisted
 * 2. GEMINI_MODEL env (always accepted as platform fallback)
 * 3. Built-in default
 *
 * Invalid / non-allowlisted tenant values never win — they fall through safely.
 */
export function resolveAdkModelName(
  configService: ConfigService,
  tenantAiModel?: string | null,
): string {
  const tenantModel = tenantAiModel?.trim();
  if (tenantModel && isAllowedAiModel(tenantModel)) {
    return tenantModel;
  }

  const envModel = configService.get<string>('GEMINI_MODEL')?.trim();
  if (envModel) {
    return envModel;
  }

  return DEFAULT_GEMINI_MODEL;
}

export function resolveAdkModelFromContext(
  configService: ConfigService,
): string {
  const context = getTrustedAiContext();
  return resolveAdkModelName(configService, context.aiModel);
}
