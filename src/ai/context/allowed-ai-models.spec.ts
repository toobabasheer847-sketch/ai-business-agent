import { ALLOWED_AI_MODELS, isAllowedAiModel } from './allowed-ai-models';

describe('ALLOWED_AI_MODELS', () => {
  it('includes gemini-3.6-flash as a supported tenant-selectable model', () => {
    expect(ALLOWED_AI_MODELS).toContain('gemini-3.6-flash');
    expect(isAllowedAiModel('gemini-3.6-flash')).toBe(true);
  });

  it('rejects null, empty, and non-allowlisted models', () => {
    expect(isAllowedAiModel(null)).toBe(false);
    expect(isAllowedAiModel('')).toBe(false);
    expect(isAllowedAiModel('gpt-4o')).toBe(false);
    expect(isAllowedAiModel('gemini-custom')).toBe(false);
  });
});
