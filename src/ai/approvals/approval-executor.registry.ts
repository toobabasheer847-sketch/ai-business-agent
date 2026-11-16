import { BadRequestException, Injectable } from '@nestjs/common';

import type { ApprovalRecord, ExecutionOutcome } from './approval.types';

type Handler = {
  validate: (record: ApprovalRecord) => Promise<void>;
  execute: (record: ApprovalRecord) => Promise<ExecutionOutcome>;
};

@Injectable()
export class ApprovalExecutorRegistry {
  private readonly handlers = new Map<string, Handler>();

  register(actionType: string, handler: Handler) {
    this.handlers.set(actionType, handler);
  }

  async validate(record: ApprovalRecord): Promise<void> {
    const handler = this.handlers.get(record.actionType);
    if (!handler) throw new BadRequestException('This action cannot be executed from the approval center.');
    await handler.validate(record);
  }

  async execute(record: ApprovalRecord): Promise<ExecutionOutcome> {
    const handler = this.handlers.get(record.actionType);
    if (!handler) throw new Error('This action has no executor.');
    return handler.execute(record);
  }
}

export function uncertainDelivery(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : '';
  return code === 'ETIMEDOUT' || code === 'ECONNABORTED' || message.includes('timeout') || message.includes('timed out');
}
