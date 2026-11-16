import { Injectable, Optional } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { assertRolePermission } from '../../../context/assert-ai-permission.js';
import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { Permission } from '../../../../modules/authorization/permissions';
import { SmsManagementService } from '../../../../integrations/twilio/sms-management';
import { CallManagementService } from '../../../../integrations/twilio/call-management';
import { ApprovalService } from '../../../approvals/approval.service';
import { uncertainDelivery } from '../../../approvals/approval-executor.registry';

// ---------------------------------------------------------------------------
// Zod schemas — compatible with the installed @google/adk FunctionTool API
// ---------------------------------------------------------------------------

const SEND_SMS_SCHEMA = z.object({
  to: z
    .string()
    .min(1)
    .describe('Destination phone number in E.164 format (e.g. +12025551234).'),
  body: z.string().min(1).describe('SMS message body text.'),
  fromPhoneNumberId: z
    .string()
    .uuid()
    .describe(
      'UUID of the phone_numbers record to send from. Must belong to the authenticated tenant.',
    ),
  statusCallback: z
    .string()
    .url()
    .optional()
    .describe('Optional URL to receive Twilio status callbacks for this message.'),
});

const INITIATE_CALL_SCHEMA = z.object({
  to: z
    .string()
    .min(1)
    .describe('Destination phone number in E.164 format.'),
  fromPhoneNumberId: z
    .string()
    .uuid()
    .describe(
      'UUID of the phone_numbers record to call from. Must belong to the authenticated tenant.',
    ),
  twiml: z
    .string()
    .optional()
    .describe('Optional TwiML instructions string to play when the call connects.'),
  callbackUrl: z
    .string()
    .url()
    .optional()
    .describe('Optional URL Twilio will fetch for call instructions (used when twiml is not provided).'),
  statusCallback: z
    .string()
    .url()
    .optional()
    .describe('Optional URL to receive Twilio call status callbacks.'),
});

// ---------------------------------------------------------------------------
// Result interfaces
// ---------------------------------------------------------------------------

export interface SmsSendResult {
  status: string;
  message: string;
  sms: {
    messageSid: string;
    from: string;
    to: string;
    body: string;
    deliveryStatus: string;
  };
}

export interface CallInitiateResult {
  status: string;
  message: string;
  call: {
    callSid: string;
    from: string;
    to: string;
    callStatus: string;
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Builds Google ADK FunctionTool instances for Twilio SMS and call operations.
 *
 * Architecture:
 *   FunctionTool → TwilioToolsProvider → SmsManagementService / CallManagementService → Twilio SDK
 *
 * Every tool uses trusted JWT tenant context. The underlying services enforce tenant
 * isolation at the phone-number and credential level.
 */
@Injectable()
export class TwilioToolsProvider {
  constructor(
    private readonly smsService: SmsManagementService,
    private readonly callService: CallManagementService,
    @Optional() private readonly approvals?: ApprovalService,
  ) {}

  /**
   * Creates the send_sms FunctionTool.
   * Delegates to SmsManagementService which validates tenant ownership of the
   * source phone number before calling the Twilio API.
   */
  createSendSmsTool(): FunctionTool<typeof SEND_SMS_SCHEMA> {
    const provider = this;
    return new FunctionTool({
      name: 'send_sms',
      description:
        'Sends an SMS message to a specified phone number using the authenticated tenant Twilio configuration.',
      parameters: SEND_SMS_SCHEMA,
      execute: async ({ to, body, fromPhoneNumberId, statusCallback }) => {
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.CommunicationView]);
        if (provider.approvals) {
          const proposed = await provider.approvals.propose({
            tenantId: trusted.tenantId,
            userId: trusted.userId,
            role: trusted.role ?? undefined,
            actionType: 'sms.send',
            title: `SMS ${to}`,
            description: body.slice(0, 180),
            targetEntityType: 'sms',
            targetEntityId: to,
            payload: { to, body, fromPhoneNumberId },
            agentName: 'communication',
          });
          return {
            status: 'pending_approval',
            message: `The SMS is waiting for approval and was not sent.${proposed.approval?.id ? ` Approval ${proposed.approval.id}.` : ''}`,
            sms: {
              messageSid: '',
              from: '',
              to,
              body,
              deliveryStatus: 'pending_approval',
            },
          } satisfies SmsSendResult;
        }
        return {
          status: 'pending_approval',
          message: 'The SMS requires approval and was not sent.',
          sms: {
            messageSid: '',
            from: '',
            to,
            body,
            deliveryStatus: 'pending_approval',
          },
        } satisfies SmsSendResult;
      },
    });
  }

  async deliverApprovedSms(input: { tenantId: string; to: string; body: string; fromPhoneNumberId: string }) {
    try {
      const result = await this.smsService.sendSms(input);
      return { reference: result.messageSid, uncertain: false as const };
    } catch (error) {
      if (uncertainDelivery(error)) return { reference: null, uncertain: true as const };
      throw error;
    }
  }

  async deliverApprovedCall(input: {
    tenantId: string;
    to: string;
    fromPhoneNumberId: string;
    twiml?: string;
    callbackUrl?: string;
    statusCallback?: string;
  }) {
    try {
      const result = await this.callService.initiateOutboundCall(input);
      return { reference: result.callSid, uncertain: false as const };
    } catch (error) {
      if (uncertainDelivery(error)) return { reference: null, uncertain: true as const };
      throw error;
    }
  }

  /**
   * Creates the initiate_call FunctionTool.
   * Delegates to CallManagementService which validates tenant ownership of the
   * source phone number before calling the Twilio API.
   */
  createInitiateCallTool(): FunctionTool<typeof INITIATE_CALL_SCHEMA> {
    const provider = this;
    return new FunctionTool({
      name: 'initiate_call',
      description:
        'Initiates an outbound phone call using the authenticated tenant Twilio configuration.',
      parameters: INITIATE_CALL_SCHEMA,
      execute: async ({ to, fromPhoneNumberId, twiml, callbackUrl, statusCallback }) => {
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.CommunicationView]);
        if (provider.approvals) {
          const proposed = await provider.approvals.propose({
            tenantId: trusted.tenantId,
            userId: trusted.userId,
            role: trusted.role ?? undefined,
            actionType: 'call.initiate',
            title: `Call ${to}`,
            description: 'An outbound call waits in the Approval Center and has not been placed.',
            targetEntityType: 'call',
            targetEntityId: to,
            payload: {
              to,
              fromPhoneNumberId,
              ...(twiml ? { twiml } : {}),
              ...(callbackUrl ? { callbackUrl } : {}),
              ...(statusCallback ? { statusCallback } : {}),
            },
            agentName: 'communication',
          });
          return {
            status: 'pending_approval',
            message: `The call is waiting for approval and was not placed.${proposed.approval?.id ? ` Approval ${proposed.approval.id}.` : ''}`,
            call: { callSid: '', from: '', to, callStatus: 'pending_approval' },
          };
        }
        return {
          status: 'pending_approval',
          message: 'The call requires approval and was not placed.',
          call: { callSid: '', from: '', to, callStatus: 'pending_approval' },
        };
      },
    });
  }
}
