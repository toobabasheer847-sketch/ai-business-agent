import { Module } from '@nestjs/common';

import { KnowledgebaseController } from './knowledgebase.controller';
import { KnowledgebaseRepository } from './knowledgebase.repository';
import { KnowledgebaseService } from './knowledgebase.service';

@Module({
  controllers: [KnowledgebaseController],
  providers: [KnowledgebaseService, KnowledgebaseRepository],
  exports: [KnowledgebaseService, KnowledgebaseRepository],
})
export class KnowledgebaseModule {}
