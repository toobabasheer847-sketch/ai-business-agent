import { AsyncLocalStorage } from 'async_hooks';

import type { RetrievedChunk } from '../agents/rag/types/rag.types';

type RagDelegationState = {
  lastChunks: RetrievedChunk[];
};

const ragDelegationStorage = new AsyncLocalStorage<RagDelegationState>();

export function runWithRagDelegationState<T>(fn: () => T): T {
  return ragDelegationStorage.run({ lastChunks: [] }, fn);
}

export function recordRagSearchChunks(chunks: RetrievedChunk[]): void {
  const state = ragDelegationStorage.getStore();
  if (state) {
    state.lastChunks = chunks;
  }
}

export function consumeRagSearchChunks(): RetrievedChunk[] {
  const state = ragDelegationStorage.getStore();
  return state?.lastChunks ?? [];
}
