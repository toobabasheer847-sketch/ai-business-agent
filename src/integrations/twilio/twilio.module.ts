import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../database/database.module';

import { TwilioAppRepository } from './twilio-app.repository';
import { TwilioAppConfigurationService } from './twilio-app-configuration';
import { PhoneNumberManagementService } from './phone-number-management';
import { CallManagementService } from './call-management';
import { SmsManagementService } from './sms-management';
import { TwilioWebhookService } from './twilio-webhooks';

@Module({
  imports: [ConfigModule, DatabaseModule],

  providers: [
    TwilioAppRepository,
    TwilioAppConfigurationService,
    PhoneNumberManagementService,
    CallManagementService,
    SmsManagementService,
    TwilioWebhookService,
  ],

  exports: [
    TwilioAppRepository,
    TwilioAppConfigurationService,
    PhoneNumberManagementService,
    CallManagementService,
    SmsManagementService,
    TwilioWebhookService,
  ],
})
export class TwilioIntegrationModule {}
