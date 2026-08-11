import { Module } from '@nestjs/common';

import { MasterSettingsController } from './master-settings.controller';
import { MasterSettingsRepository } from './master-settings.repository';
import { MasterSettingsService } from './master-settings.service';

@Module({
  controllers: [MasterSettingsController],
  providers: [MasterSettingsService, MasterSettingsRepository],
  exports: [MasterSettingsService],
})
export class MasterSettingsModule {}
