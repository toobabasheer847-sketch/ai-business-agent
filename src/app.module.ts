import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CommunicationHubModule } from './modules/communication-hub/communication-hub.module';
import { CompanyModule } from './modules/company/company.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { GmailConfigurationModule } from './modules/gmail-configuration/gmail-configuration.module';
import { KnowledgebaseModule } from './modules/knowledgebase/knowledgebase.module';
import { LeadModule } from './modules/lead/lead.module';
import { LogsModule } from './modules/logs/logs.module';
import { MasterSettingsModule } from './modules/master-settings/master-settings.module';

@Module({

  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,
    AuthModule,
    BrandModule,
    CommunicationHubModule,
    CompanyModule,
    ConversationModule,
    GmailConfigurationModule,
    KnowledgebaseModule,
    LeadModule,
    LogsModule,
    MasterSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
