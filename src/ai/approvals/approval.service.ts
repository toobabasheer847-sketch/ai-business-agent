import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ApprovalLifecycle,
  parseApprovalQuery,
  type Actor,
} from './approval-lifecycle';
import { parseExtraApprovalActions } from './approval-policy';
import { ApprovalExecutorRegistry } from './approval-executor.registry';
import { DrizzleApprovalStore } from './approval.store';
import type { ApprovalRecord } from './approval.types';

type DecisionListener = (actor: Actor, record: ApprovalRecord) => Promise<void>;

@Injectable()
export class ApprovalService {
  private readonly lifecycle: ApprovalLifecycle;
  private readonly decisions: DecisionListener[] = [];

  constructor(
    store: DrizzleApprovalStore,
    registry: ApprovalExecutorRegistry,
    configService: ConfigService,
  ) {
    this.lifecycle = new ApprovalLifecycle(
      store,
      registry,
      parseExtraApprovalActions(
        configService.get<string>('AI_APPROVAL_EXTRA_ACTIONS'),
      ),
    );
  }

  onDecision(listener: DecisionListener) {
    this.decisions.push(listener);
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

  async approve(actor: Actor, id: string, edits?: Record<string, unknown>) {
    const record = await this.lifecycle.approve(actor, id, edits);
    await this.notify(actor, record);
    return record;
  }

  async reject(actor: Actor, id: string, reason: string) {
    const record = await this.lifecycle.reject(actor, id, reason);
    await this.notify(actor, record);
    return record;
  }

  async cancel(actor: Actor, id: string) {
    const record = await this.lifecycle.cancel(actor, id);
    await this.notify(actor, record);
    return record;
  }

  private async notify(actor: Actor, record: ApprovalRecord) {
    for (const listener of this.decisions) {
      await listener(actor, record).catch(() => undefined);
    }
  }
}
