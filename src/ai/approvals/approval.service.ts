import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApprovalLifecycle, parseApprovalQuery, type Actor } from './approval-lifecycle';
import { parseExtraApprovalActions } from './approval-policy';
import { ApprovalExecutorRegistry } from './approval-executor.registry';
import { DrizzleApprovalStore } from './approval.store';

@Injectable()
export class ApprovalService {
  private readonly lifecycle: ApprovalLifecycle;

  constructor(
    store: DrizzleApprovalStore,
    registry: ApprovalExecutorRegistry,
    configService: ConfigService,
  ) {
    this.lifecycle = new ApprovalLifecycle(
      store,
      registry,
      parseExtraApprovalActions(configService.get<string>('AI_APPROVAL_EXTRA_ACTIONS')),
    );
  }

  propose(input: Parameters<ApprovalLifecycle['propose']>[0]) {
    return this.lifecycle.propose(input);
  }

  list(actor: Actor, raw: Parameters<typeof parseApprovalQuery>[0]) {
    return this.lifecycle.list(actor, parseApprovalQuery(raw));
  }

  summary(actor: Actor) {
    return this.lifecycle.summary(actor);
  }

  find(actor: Actor, id: string) {
    return this.lifecycle.find(actor, id);
  }

  events(actor: Actor, id: string) {
    return this.lifecycle.events(actor, id);
  }

  approve(actor: Actor, id: string, edits?: Record<string, unknown>) {
    return this.lifecycle.approve(actor, id, edits);
  }

  reject(actor: Actor, id: string, reason: string) {
    return this.lifecycle.reject(actor, id, reason);
  }

  cancel(actor: Actor, id: string) {
    return this.lifecycle.cancel(actor, id);
  }
}
