import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';

import { CommunicationToolsProvider } from '../agents/communication/communication-tools.provider';
import { TwilioToolsProvider } from '../agents/communication/twilio/twilio-tools.provider';
import { ProposalDeliveryService } from '../agents/proposal/proposal-delivery.service';
import { ProposalRepository } from '../agents/proposal/proposal.repository';
import { TaskService } from '../agents/task/task.service';
import { CompanyService } from '../../modules/company/company.service';
import { OmnichannelService } from '../../modules/omnichannel/omnichannel.service';
import { uncertainDelivery } from './approval-executor.registry';
import { ApprovalExecutorRegistry } from './approval-executor.registry';
import type { ApprovalRecord } from './approval.types';

const PURPOSE = z.enum(['transactional', 'customer_requested', 'marketing']).optional();

const EMAIL_PAYLOAD = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(4000),
  body: z.string().trim().min(1).max(4000),
  fromEmail: z.string().email().optional(),
  purpose: PURPOSE,
  dispatchId: z.string().uuid().optional(),
});

const SMS_PAYLOAD = z.object({
  to: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(4000),
  fromPhoneNumberId: z.string().uuid(),
  purpose: PURPOSE,
  dispatchId: z.string().uuid().optional(),
});

const WHATSAPP_PAYLOAD = z.object({
  to: z.string().trim().min(1).max(40),
  body: z.string().trim().max(4096).optional(),
  purpose: PURPOSE,
  dispatchId: z.string().uuid(),
  providerTemplateRef: z.string().trim().max(120).optional(),
});

const CAMPAIGN_PAYLOAD = z.object({
  campaignId: z.string().uuid(),
});

const CALL_PAYLOAD = z.object({
  to: z.string().trim().min(1).max(40),
  fromPhoneNumberId: z.string().uuid(),
  twiml: z.string().max(4000).optional(),
  callbackUrl: z.string().url().optional(),
  statusCallback: z.string().url().optional(),
});

const COMPANY_PAYLOAD = z.object({
  name: z.string().trim().min(1).max(255),
});

const TASK_PAYLOAD = z.object({
  title: z.string().trim().min(3).max(255),
  companyId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  prospectId: z.string().uuid().optional(),
});

@Injectable()
export class ApprovalExecutionRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ApprovalExecutorRegistry,
    private readonly companies: CompanyService,
    private readonly proposals: ProposalRepository,
    private readonly delivery: ProposalDeliveryService,
    private readonly mail: CommunicationToolsProvider,
    private readonly sms: TwilioToolsProvider,
    private readonly tasks: TaskService,
    private readonly outbound: OmnichannelService,
  ) {}

  onModuleInit() {
    this.registry.register('company.delete', {
      validate: async (record) => { await this.companies.findOne(record.tenantId, record.targetEntityId); },
      execute: async (record) => {
        await this.companies.remove(record.tenantId, record.targetEntityId);
        return { reference: record.targetEntityId };
      },
    });
    this.registry.register('proposal.send', {
      validate: async (record) => {
        const proposal = await this.proposals.getProposal(record.targetEntityId, record.tenantId);
        if (!proposal || proposal.tenantId !== record.tenantId) throw new Error('Proposal not found');
        if (proposal.status === 'sent') throw new Error('This proposal has already been sent.');
      },
      execute: async (record) => {
        const proposal = await this.proposals.getProposal(record.targetEntityId, record.tenantId);
        if (!proposal) throw new Error('Proposal not found');
        try {
          const sent = await this.delivery.sendProposalEmail({
            proposal,
            tenantId: record.tenantId,
            userId: record.approverUserId ?? undefined,
          });
          return { reference: sent.messageId };
        } catch (error) {
          if (uncertainDelivery(error)) return { reference: null, uncertain: true };
          throw error;
        }
      },
    });
    this.registry.register('email.send', {
      validate: async (record) => { parsePayload(EMAIL_PAYLOAD, record); },
      execute: (record) => {
        const payload = parsePayload(EMAIL_PAYLOAD, record);
        if (payload.dispatchId) return this.outbound.fulfillApproved(record.tenantId, payload.dispatchId);
        return this.mail.deliverApprovedEmail({
          tenantId: record.tenantId,
          to: payload.to,
          subject: payload.subject,
          body: payload.body,
          fromEmail: payload.fromEmail,
          purpose: payload.purpose,
        });
      },
    });
    this.registry.register('sms.send', {
      validate: async (record) => { parsePayload(SMS_PAYLOAD, record); },
      execute: (record) => {
        const payload = parsePayload(SMS_PAYLOAD, record);
        if (payload.dispatchId) return this.outbound.fulfillApproved(record.tenantId, payload.dispatchId);
        return this.sms.deliverApprovedSms({
          tenantId: record.tenantId,
          to: payload.to,
          body: payload.body,
          fromPhoneNumberId: payload.fromPhoneNumberId,
          purpose: payload.purpose,
        });
      },
    });
    this.registry.register('whatsapp.send', {
      validate: async (record) => { parsePayload(WHATSAPP_PAYLOAD, record); },
      execute: (record) => {
        const payload = parsePayload(WHATSAPP_PAYLOAD, record);
        return this.outbound.fulfillApproved(record.tenantId, payload.dispatchId);
      },
    });
    this.registry.register('campaign.send', {
      validate: async (record) => { parsePayload(CAMPAIGN_PAYLOAD, record); },
      execute: async (record) => {
        const payload = parsePayload(CAMPAIGN_PAYLOAD, record);
        const completed = await this.outbound.executeCampaign(
          record.tenantId,
          record.approverUserId ?? record.requesterUserId ?? '',
          payload.campaignId,
        );
        return { reference: completed?.id ?? payload.campaignId };
      },
    });
    this.registry.register('call.initiate', {
      validate: async (record) => { parsePayload(CALL_PAYLOAD, record); },
      execute: (record) => {
        const payload = parsePayload(CALL_PAYLOAD, record);
        return this.sms.deliverApprovedCall({
          tenantId: record.tenantId,
          to: payload.to,
          fromPhoneNumberId: payload.fromPhoneNumberId,
          twiml: payload.twiml,
          callbackUrl: payload.callbackUrl,
          statusCallback: payload.statusCallback,
        });
      },
    });
    this.registry.register('company.create', {
      validate: async (record) => { parsePayload(COMPANY_PAYLOAD, record); },
      execute: async (record) => {
        const payload = parsePayload(COMPANY_PAYLOAD, record);
        const created = await this.companies.create(record.tenantId, record.approverUserId ?? record.requesterUserId ?? '', { name: payload.name });
        return { reference: created.id };
      },
    });
    this.registry.register('task.create', {
      validate: async (record) => { parsePayload(TASK_PAYLOAD, record); },
      execute: async (record) => {
        const payload = parsePayload(TASK_PAYLOAD, record);
        const created = await this.tasks.createTask(
          {
            title: payload.title,
            companyId: payload.companyId,
            leadId: payload.leadId,
            prospectId: payload.prospectId,
          },
          {
            tenantId: record.tenantId,
            userId: record.approverUserId ?? record.requesterUserId ?? '',
          },
        );
        return { reference: created.id };
      },
    });
  }
}

function finalPayload(record: ApprovalRecord): Record<string, unknown> {
  return record.approvedPayload ?? record.originalPayload;
}

function parsePayload<T>(schema: z.ZodType<T>, record: ApprovalRecord): T {
  const parsed = schema.safeParse(finalPayload(record));
  if (!parsed.success) {
    throw new BadRequestException('The approved action is missing required details.');
  }
  return parsed.data;
}
