import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Twilio from 'twilio';

import { TwilioAppConfigurationService } from './twilio-app-configuration';

export type AvailableNumberType = 'local' | 'tollFree';

export interface SearchAvailableNumbersInput {
  tenantId: string;
  countryCode: string;
  locality?: string;
  areaCode?: number;
  contains?: string;
  type?: AvailableNumberType;
  limit?: number;
}

export interface AvailablePhoneNumberResult {
  phoneNumber: string;
  friendlyName: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  isoCountry: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  addressRequirements: string | null;
  beta: boolean;
  type: AvailableNumberType;
}

export interface PurchasePhoneNumberInput {
  tenantId: string;
  phoneNumber: string;
  friendlyName?: string;
}

export interface PurchasedPhoneNumberResult {
  phoneNumber: string;
  sid: string;
  friendlyName: string | null;
  status: string | null;
}

@Injectable()
export class AvailablePhoneNumbersService {
  private readonly logger = new Logger(AvailablePhoneNumbersService.name);

  constructor(
    private readonly configService: TwilioAppConfigurationService,
  ) {}

  private async getClient(tenantId: string) {
    const credentials =
      await this.configService.resolveCredentialsForTenant(tenantId);

    if (!credentials) {
      throw new ServiceUnavailableException(
        'Twilio credentials are not configured for this tenant. Save Account SID and Auth Token on a Phone Number, or set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN.',
      );
    }

    return Twilio(credentials.accountSid, credentials.authToken);
  }

  async searchAvailable(
    input: SearchAvailableNumbersInput,
  ): Promise<AvailablePhoneNumberResult[]> {
    const countryCode = input.countryCode.trim().toUpperCase();
    const type: AvailableNumberType = input.type ?? 'local';
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    const client = await this.getClient(input.tenantId);

    const listOptions: Record<string, unknown> = {
      limit,
      smsEnabled: true,
      voiceEnabled: true,
    };

    if (input.locality?.trim()) {
      listOptions.inLocality = input.locality.trim();
    }

    if (input.areaCode !== undefined) {
      listOptions.areaCode = input.areaCode;
    }

    if (input.contains?.trim()) {
      listOptions.contains = input.contains.trim();
    }

    try {
      const country = client.availablePhoneNumbers(countryCode);
      const records =
        type === 'tollFree'
          ? await country.tollFree.list(listOptions as any)
          : await country.local.list(listOptions as any);

      return records.map((item) => ({
        phoneNumber: item.phoneNumber,
        friendlyName: item.friendlyName ?? null,
        locality: item.locality ?? null,
        region: item.region ?? null,
        postalCode: item.postalCode ?? null,
        isoCountry: item.isoCountry ?? countryCode,
        capabilities: {
          voice: Boolean(item.capabilities?.voice),
          sms: Boolean(item.capabilities?.sms),
          mms: Boolean(item.capabilities?.mms),
        },
        addressRequirements: item.addressRequirements ?? null,
        beta: Boolean(item.beta),
        type,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Twilio available-number search failed';
      throw new BadGatewayException(
        `Unable to search available phone numbers: ${message}`,
      );
    }
  }

  /**
   * Purchases an E.164 number. Does not configure Twilio webhooks and does
   * not persist to the local DB — the Phone Numbers service does that.
   */
  async purchaseNumber(
    input: PurchasePhoneNumberInput,
  ): Promise<PurchasedPhoneNumberResult> {
    const phoneNumber = input.phoneNumber.trim();
    const client = await this.getClient(input.tenantId);

    // Best-effort availability check (US/CA local search by exact match pattern).
    // Purchase itself remains the source of truth if Twilio rejects.
    try {
      const countryHint = phoneNumber.startsWith('+1') ? 'US' : undefined;
      if (countryHint) {
        const stillAvailable = await client
          .availablePhoneNumbers(countryHint)
          .local.list({
            contains: phoneNumber.replace(/^\+/, ''),
            limit: 5,
          });

        const match = stillAvailable.some((n) => n.phoneNumber === phoneNumber);
        if (!match) {
          // Also check toll-free inventory for +1 numbers.
          const tollFree = await client
            .availablePhoneNumbers(countryHint)
            .tollFree.list({
              contains: phoneNumber.replace(/^\+/, ''),
              limit: 5,
            });
          const tollMatch = tollFree.some((n) => n.phoneNumber === phoneNumber);
          if (!tollMatch) {
            // Do not hard-fail solely on search miss — inventory filters can be imperfect.
            // Proceed to purchase; Twilio will reject if unavailable.
          }
        }
      }
    } catch {
      // Availability probe failures should not block purchase attempt.
    }

    let purchasedSid: string | null = null;

    try {
      const purchased = await client.incomingPhoneNumbers.create({
        phoneNumber,
        friendlyName: input.friendlyName?.trim() || undefined,
      });

      purchasedSid = purchased.sid;

      return {
        phoneNumber: purchased.phoneNumber ?? phoneNumber,
        sid: purchased.sid,
        friendlyName: purchased.friendlyName ?? null,
        status: purchased.status ?? null,
      };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Twilio purchase failed';

      this.logger.error(
        {
          tenantId: input.tenantId,
          phoneNumber,
          sid: purchasedSid,
          err: message,
        },
        'Unable to purchase phone number',
      );

      throw new BadGatewayException(
        `Unable to purchase phone number: ${message}`,
      );
    }
  }
}
