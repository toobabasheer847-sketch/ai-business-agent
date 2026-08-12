import { Module } from '@nestjs/common';

import { GmailConfigurationController } from './gmail-configuration.controller';
import { GmailConfigurationRepository } from './gmail-configuration.repository';
import { GmailConfigurationService } from './gmail-configuration.service';

@Module({
  controllers: [GmailConfigurationController],
  providers: [GmailConfigurationService, GmailConfigurationRepository],
  exports: [GmailConfigurationService],
})
export class GmailConfigurationModule {}
