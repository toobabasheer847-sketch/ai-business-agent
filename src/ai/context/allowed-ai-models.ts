/**
 * Allowlisted Gemini model IDs that tenants may select via master_settings.aiModel.
 * Unknown/invalid values fall back to GEMINI_MODEL (or the default) at runtime.
 *
 * gemini-3.6-flash is intentional: it is this project's Communication agent default
 * and a supported GEMINI_MODEL / tenant override value.
 */
export const ALLOWED_AI_MODELS = [
  'gemini-3.6-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro-001',
] as const;

export type AllowedAiModel = (typeof ALLOWED_AI_MODELS)[number];

export function isAllowedAiModel(model: string | null | undefined): boolean {
  if (!model?.trim()) {
    return false;
  }
  return (ALLOWED_AI_MODELS as readonly string[]).includes(model.trim());
}
