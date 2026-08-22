import {
  getTrustedAiContext,
  runWithAiContext,
  type AiRequestContext,
} from '../../context/ai-request-context.js';

export type TaskContext = AiRequestContext;

export const runWithTaskContext = runWithAiContext;
export const getTrustedTaskContext = getTrustedAiContext;
