import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { GmailModule } from '../../ai/agents/communication/gmail/gmail.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { GmailIntegrationModule } from '../../integrations/gmail/gmail.module';
import { TwilioIntegrationModule } from '../../integrations/twilio/twilio.module';
import { ExceptionModule } from '../exceptions/exception.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { DispatchProcessor } from './dispatch.processor';
import { EmailChannelAdapter } from './email-channel.adapter';
import { OmnichannelController } from './omnichannel.controller';
import { OmnichannelRepository } from './omnichannel.repository';
import { OmnichannelService } from './omnichannel.service';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { WhatsAppChannelAdapter } from './whatsapp-channel.adapter';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.COMMUNICATION_DISPATCH }),
    GmailModule,
    GmailIntegrationModule,
    TwilioIntegrationModule,
    ExceptionModule,
    forwardRef(() => WorkflowModule),
  ],
  controllers: [OmnichannelController, WhatsAppWebhookController],
  providers: [
    OmnichannelRepository,
    OmnichannelService,
    EmailChannelAdapter,
    SmsChannelAdapter,
    WhatsAppChannelAdapter,
    DispatchProcessor,
  ],
  exports: [OmnichannelService],
})
export class OmnichannelModule {}
