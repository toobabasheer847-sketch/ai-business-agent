import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../../../database/database.module';
import { GmailIntegrationModule } from '../../../../integrations/gmail/gmail.module';

import { GmailController } from './gmail.controller';
import { GmailOauthStateService } from './gmail-oauth-state.service';
import { GmailRepository } from './gmail.repository';
import { GmailService } from './gmail.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GmailIntegrationModule,
  ],

  controllers: [
    GmailController,
  ],

  providers: [
    GmailService,
    GmailRepository,
    GmailOauthStateService,
  ],

  exports: [
    GmailService,
    GmailRepository,
  ],
})
export class GmailModule {}