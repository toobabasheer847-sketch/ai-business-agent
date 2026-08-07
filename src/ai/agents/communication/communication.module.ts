import { Module } from '@nestjs/common';

import { CommunicationAgentController } from './communication.controller';
import { CommunicationAgentService } from './communication.service';
import { GmailModule } from './gmail/gmail.module';

@Module({
  imports: [
    GmailModule,
  ],

  controllers: [
    CommunicationAgentController,
  ],

  providers: [
    CommunicationAgentService,
  ],

  exports: [
    CommunicationAgentService,
  ],
})
export class CommunicationAgentModule {}