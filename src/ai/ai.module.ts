import { Module } from '@nestjs/common';

import { MasterAgentModule } from './agents/master/master.module';

@Module({
  imports: [
    MasterAgentModule,
  ],

  exports: [
    MasterAgentModule,
  ],
})
export class AiModule {}