import { Module } from '@nestjs/common';

import { TwilioAppController } from './twilio-app.controller';
import { TwilioAppRepository } from './twilio-app.repository';
import { TwilioAppService } from './twilio-app.service';

@Module({
  controllers: [TwilioAppController],
  providers: [TwilioAppService, TwilioAppRepository],
  exports: [TwilioAppService, TwilioAppRepository],
})
export class TwilioAppModule {}
