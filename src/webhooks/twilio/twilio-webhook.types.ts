import type { Request } from 'express';

/**
 * Raw body from Twilio webhook — all fields are strings per the Twilio spec.
 */
export type TwilioWebhookBody = Record<string, string>;

/**
 * Express request that carries a pre-parsed Twilio webhook body.
 */
export interface TwilioWebhookRequest extends Request {
  body: TwilioWebhookBody;
}
