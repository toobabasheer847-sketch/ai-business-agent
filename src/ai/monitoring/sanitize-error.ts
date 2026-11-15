export function sanitizeProviderError(error: unknown): { code: string; summary: string } {
  const code = (error instanceof Error ? error.name : 'Error').replace(/[^\w.-]/g, '').slice(0, 80) || 'Error';
  const raw = error instanceof Error ? error.message : 'The AI provider request failed.';
  const summary = raw
    .replace(/AIza[\w-]{10,}/g, '[redacted]')
    .replace(/sk-[\w-]{10,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return { code, summary: summary || 'The AI provider request failed.' };
}
