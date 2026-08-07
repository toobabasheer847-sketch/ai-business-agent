import { AgentContext } from '../types/ai.types';

export const buildAgentContext = (context: AgentContext) => ({
  tenantId: context.tenantId,
  userId: context.userId,
  email: context.email,
});
