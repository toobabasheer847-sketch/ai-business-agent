import {
  DEFAULT_AI_CHAT_HISTORY_LIMIT,
  MAX_AI_CHAT_HISTORY_LIMIT,
  resolveChatHistoryLimit,
} from './ai.config';

describe('resolveChatHistoryLimit', () => {
  it('defaults to 20 when unset or invalid', () => {
    expect(resolveChatHistoryLimit(undefined)).toBe(
      DEFAULT_AI_CHAT_HISTORY_LIMIT,
    );
    expect(resolveChatHistoryLimit('')).toBe(DEFAULT_AI_CHAT_HISTORY_LIMIT);
    expect(resolveChatHistoryLimit('nope')).toBe(DEFAULT_AI_CHAT_HISTORY_LIMIT);
    expect(resolveChatHistoryLimit(0)).toBe(DEFAULT_AI_CHAT_HISTORY_LIMIT);
  });

  it('caps the limit at 50', () => {
    expect(resolveChatHistoryLimit(20)).toBe(20);
    expect(resolveChatHistoryLimit('50')).toBe(MAX_AI_CHAT_HISTORY_LIMIT);
    expect(resolveChatHistoryLimit(999)).toBe(MAX_AI_CHAT_HISTORY_LIMIT);
  });
});
