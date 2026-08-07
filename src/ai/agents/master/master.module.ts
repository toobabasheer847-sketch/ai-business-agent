import { Module } from '@nestjs/common';

import { MasterAgentController } from './master.controller';
import { MasterAgentService } from './master.service';

@Module({
  controllers: [MasterAgentController],

  providers: [MasterAgentService],

  exports: [MasterAgentService],
})
export class MasterAgentModule {}