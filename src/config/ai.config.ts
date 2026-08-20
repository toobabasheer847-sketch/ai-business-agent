export const DEFAULT_AI_CHAT_HISTORY_LIMIT = 20;
export const MAX_AI_CHAT_HISTORY_LIMIT = 50;

export function resolveChatHistoryLimit(
  raw: string | number | undefined,
): number {
  const parsed =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_AI_CHAT_HISTORY_LIMIT;
  }

  return Math.min(Math.trunc(parsed), MAX_AI_CHAT_HISTORY_LIMIT);
}

export default function aiConfig() {
  return {
    GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
    AI_CHAT_HISTORY_LIMIT: resolveChatHistoryLimit(
      process.env.AI_CHAT_HISTORY_LIMIT,
    ),
  };
}
