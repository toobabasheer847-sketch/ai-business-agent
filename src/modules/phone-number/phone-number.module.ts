import { Module } from '@nestjs/common';

import { TwilioIntegrationModule } from '../../integrations/twilio/twilio.module';
import { PhoneNumberController } from './phone-number.controller';
import { PhoneNumberRepository } from './phone-number.repository';
import { PhoneNumberService } from './phone-number.service';

@Module({
  imports: [TwilioIntegrationModule],
  controllers: [PhoneNumberController],
  providers: [PhoneNumberService, PhoneNumberRepository],
  exports: [PhoneNumberService, PhoneNumberRepository],
})
export class PhoneNumberModule {}
