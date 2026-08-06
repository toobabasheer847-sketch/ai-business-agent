import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagAgent } from './rag.agent';
import { RagTools } from './rag.tools';

@Module({
  imports: [ConfigModule],
  controllers: [RagController],
  providers: [RagService, RagAgent, RagTools],
  exports: [RagService],
})
export class RagModule {}

