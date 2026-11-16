import { createHash } from 'node:crypto';

const SECRET_KEY = /token|password|secret|apikey|api_key|authorization|credential|refresh/i;

export function sanitizeApprovalPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof entry === 'string') {
      output[key] = entry
        .replace(/AIza[\w-]{10,}/g, '[redacted]')
        .replace(/sk-[\w-]{10,}/g, '[redacted]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .slice(0, 4000);
    } else if (typeof entry === 'number' || typeof entry === 'boolean' || entry === null) {
      output[key] = entry;
    }
  }
  return output;
}

export function payloadHash(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(Object.keys(payload).sort().map((key) => [key, payload[key]]));
  return createHash('sha256').update(stable).digest('hex');
}

export function applyApprovalEdits(
  original: Record<string, unknown>,
  edits: Record<string, unknown> | undefined,
  allowed: string[],
): Record<string, unknown> {
  if (!edits || Object.keys(edits).length === 0) return { ...original };
  const unknown = Object.keys(edits).filter((key) => !allowed.includes(key));
  if (unknown.length || allowed.length === 0) {
    throw new Error('This action cannot be edited before approval.');
  }
  const next = { ...original };
  for (const key of allowed) {
    if (edits[key] === undefined) continue;
    if (typeof edits[key] !== 'string') throw new Error('Edited values must be text.');
    const value = edits[key].trim();
    if (!value || value.length > 4000) throw new Error('An edited value is empty or too long.');
    next[key] = value;
  }
  return next;
}
