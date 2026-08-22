import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { SmsManagementService } from '../../../../integrations/twilio/sms-management';
import { CallManagementService } from '../../../../integrations/twilio/call-management';

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
        const { tenantId } = getTrustedAiContext();
        const result = await provider.smsService.sendSms({
          tenantId,
          to,
          body,
          fromPhoneNumberId,
          statusCallback,
        });

        return {
          status: 'success',
          message: 'SMS sent successfully.',
          sms: {
            messageSid: result.messageSid,
            from: result.from,
            to: result.to,
            body: result.body,
            deliveryStatus: result.status,
          },
        } satisfies SmsSendResult;
      },
    });
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
        const { tenantId } = getTrustedAiContext();
        const result = await provider.callService.initiateOutboundCall({
          tenantId,
          to,
          fromPhoneNumberId,
          twiml,
          callbackUrl,
          statusCallback,
        });

        return {
          status: 'success',
          message: 'Call initiated successfully.',
          call: {
            callSid: result.callSid,
            from: result.from,
            to: result.to,
            callStatus: result.status,
          },
        } satisfies CallInitiateResult;
      },
    });
  }
}
