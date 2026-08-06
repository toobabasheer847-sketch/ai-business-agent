import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RagModule } from './agents/rag/rag.module';

@Module({
  imports: [ConfigModule, RagModule],
})
export class AiModule {}
