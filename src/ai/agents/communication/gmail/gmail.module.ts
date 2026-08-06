import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../../../database/database.module';

import { GmailController } from './gmail.controller';
// GmailRepository import removed: module file not found. If a repository is added,
// re-add it here (e.g. import { GmailRepository } from './gmail.repository';)
import { GmailService } from './gmail.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],

  controllers: [
    GmailController,
  ],

  providers: [
    GmailService,
  ],

  exports: [
    GmailService,
  ],
})
export class GmailModule {}