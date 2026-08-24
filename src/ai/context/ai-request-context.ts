import { AsyncLocalStorage } from 'async_hooks';
import { UnauthorizedException } from '@nestjs/common';

export type AiRequestContext = {
  tenantId: string;
  userId: string;
  email?: string | null;
  aiModel?: string | null;
};

const aiContextStorage = new AsyncLocalStorage<AiRequestContext>();

export function runWithAiContext<T>(
  context: AiRequestContext,
  fn: () => T,
): T {
  if (!context?.tenantId || !context?.userId) {
    throw new UnauthorizedException('Tenant context is required');
  }

  return aiContextStorage.run(context, fn);
}

export function getTrustedAiContext(): AiRequestContext {
  const context = aiContextStorage.getStore();

  if (!context?.tenantId || !context?.userId) {
    throw new UnauthorizedException(
      'Trusted AI context is required; tenantId and userId cannot come from the model',
    );
  }

  return context;
}
