import { Module } from '@nestjs/common';

import { CommunicationHubController } from './communication-hub.controller';
import { CommunicationHubRepository } from './communication-hub.repository';
import { CommunicationHubService } from './communication-hub.service';

@Module({
  controllers: [CommunicationHubController],
  providers: [CommunicationHubService, CommunicationHubRepository],
  exports: [CommunicationHubService],
})
export class CommunicationHubModule {}
