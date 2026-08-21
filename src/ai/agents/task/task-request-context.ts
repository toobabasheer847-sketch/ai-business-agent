import { AsyncLocalStorage } from 'async_hooks';
import { UnauthorizedException } from '@nestjs/common';

import type { TaskContext } from './types/task.types';

const taskContextStorage = new AsyncLocalStorage<TaskContext>();

export function runWithTaskContext<T>(
  context: TaskContext,
  fn: () => T,
): T {
  if (!context?.tenantId || !context?.userId) {
    throw new UnauthorizedException('Tenant context is required');
  }

  return taskContextStorage.run(context, fn);
}

export function getTrustedTaskContext(): TaskContext {
  const context = taskContextStorage.getStore();

  if (!context?.tenantId || !context?.userId) {
    throw new UnauthorizedException(
      'Task security context is required; tenantId and user identity cannot come from the model',
    );
  }

  return context;
}
