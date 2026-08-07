import { Module } from '@nestjs/common';

import { MasterAgentModule } from './agents/master/master.module';
import { CommunicationAgentModule } from './agents/communication/communication.module';

@Module({
  imports: [
    MasterAgentModule,
    CommunicationAgentModule,
  ],

  exports: [
    MasterAgentModule,
    CommunicationAgentModule,
  ],
})
export class AiModule {}