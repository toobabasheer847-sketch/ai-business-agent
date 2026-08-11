import { Module } from '@nestjs/common';

import { CommunicationAgentController } from './communication.controller';
import { CommunicationAgentService } from './communication.service';
import { CommunicationToolsProvider } from './communication-tools.provider';
import { GmailModule } from './gmail/gmail.module';
import { TwilioToolsProvider } from './twilio/twilio-tools.provider';
import { TwilioIntegrationModule } from '../../../integrations/twilio/twilio.module';

@Module({
  imports: [
    GmailModule,
    TwilioIntegrationModule,
  ],

  controllers: [
    CommunicationAgentController,
  ],

  providers: [
    CommunicationToolsProvider,
    TwilioToolsProvider,
    CommunicationAgentService,
  ],

  exports: [
    CommunicationAgentService,
    CommunicationToolsProvider,
    TwilioToolsProvider,
  ],
})
export class CommunicationAgentModule {}
