import { Module } from '@nestjs/common';

import { PhoneNumberController } from './phone-number.controller';
import { PhoneNumberRepository } from './phone-number.repository';
import { PhoneNumberService } from './phone-number.service';

@Module({
  controllers: [PhoneNumberController],
  providers: [PhoneNumberService, PhoneNumberRepository],
  exports: [PhoneNumberService, PhoneNumberRepository],
})
export class PhoneNumberModule {}
