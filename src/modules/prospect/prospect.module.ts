import { Module } from '@nestjs/common';

import { ProspectController } from './prospect.controller';
import { ProspectRepository } from './prospect.repository';
import { ProspectService } from './prospect.service';

@Module({
  controllers: [ProspectController],
  providers: [ProspectService, ProspectRepository],
  exports: [ProspectService, ProspectRepository],
})
export class ProspectModule {}
