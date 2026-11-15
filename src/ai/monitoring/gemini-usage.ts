export type ProviderUsage = {
  available: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  note: string | null;
};

const UNAVAILABLE_NOTE = 'The provider response did not include token counts.';

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

export function extractGeminiUsage(response: unknown): ProviderUsage {
  const metadata = response && typeof response === 'object'
    ? (response as { usageMetadata?: Record<string, unknown> }).usageMetadata
    : undefined;
  if (!metadata || typeof metadata !== 'object') {
    return { available: false, inputTokens: null, outputTokens: null, totalTokens: null, note: UNAVAILABLE_NOTE };
  }

  const inputTokens = numberOrNull(metadata.promptTokenCount);
  const outputTokens = numberOrNull(metadata.candidatesTokenCount);
  const totalTokens = numberOrNull(metadata.totalTokenCount);
  if (inputTokens === null || outputTokens === null || totalTokens === null) {
    return { available: false, inputTokens: null, outputTokens: null, totalTokens: null, note: UNAVAILABLE_NOTE };
  }

  return { available: true, inputTokens, outputTokens, totalTokens, note: null };
}

export function unavailableUsage(note: string): ProviderUsage {
  return { available: false, inputTokens: null, outputTokens: null, totalTokens: null, note: note.slice(0, 200) };
}
