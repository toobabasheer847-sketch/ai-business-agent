import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ProposalService } from '../../ai/agents/proposal/proposal.service.js';
import { AppLogger } from '../logging/logger.service';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly appLogger: AppLogger,
    private readonly proposalService: ProposalService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'proposal-expiry-check',
    timeZone: 'UTC',
  })
  async handleProposalExpiry(): Promise<void> {
    const now = new Date();
    const requestId = `cron:proposal-expiry:${now.toISOString()}`;

    try {
      const result = await this.proposalService.runProposalExpiryJob();

      if (result.proposalsExpired > 0) {
        this.appLogger.log(
          `Proposal expiry job: marked ${result.proposalsExpired} proposal(s) as expired across ${result.tenantsScanned} tenant(s)`,
          { requestId },
          {
            expiredCount: result.proposalsExpired,
            tenantsScanned: result.tenantsScanned,
            perTenant: result.perTenant,
            job: 'proposal-expiry-check',
          },
        );
      } else {
        this.appLogger.log(
          'Proposal expiry job completed: no stale proposals found',
          { requestId },
          { job: 'proposal-expiry-check', tenantsScanned: result.tenantsScanned },
        );
      }
    } catch (error) {
      this.appLogger.error(
        'Proposal expiry cron job failed',
        error instanceof Error ? error.stack : undefined,
        { requestId },
        { job: 'proposal-expiry-check' },
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'gmail-token-health-check',
    timeZone: 'UTC',
  })
  async handleGmailTokenHealth(): Promise<void> {
    const now = new Date();

    this.appLogger.log(
      'Gmail token health check: triggered (safe no-op for this phase)',
      { requestId: `cron:gmail-token-health:${now.toISOString()}` },
      {
        job: 'gmail-token-health-check',
        note: 'Token-refresh business logic will consume Gmail OAuth APIs in a later feature phase.',
      },
    );
  }
}