import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CommunicationHubModule } from './modules/communication-hub/communication-hub.module';
import { CompanyModule } from './modules/company/company.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { GmailConfigurationModule } from './modules/gmail-configuration/gmail-configuration.module';
import { KnowledgebaseModule } from './modules/knowledgebase/knowledgebase.module';
import { LeadModule } from './modules/lead/lead.module';
import { MasterSettingsModule } from './modules/master-settings/master-settings.module';
import { MessageModule } from './modules/message/message.module';
import { PhoneNumberModule } from './modules/phone-number/phone-number.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { ProspectModule } from './modules/prospect/prospect.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { TwilioAppModule } from './modules/twilio-app/twilio-app.module';
import { UserModule } from './modules/user/user.module';
import { TwilioWebhooksModule } from './webhooks/twilio/twilio-webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    InfrastructureModule,
    AuthModule,
    TenantModule,
    UserModule,
    BrandModule,
    CompanyModule,
    LeadModule,
    ProspectModule,
    ConversationModule,
    MessageModule,
    CommunicationHubModule,
    GmailConfigurationModule,
    KnowledgebaseModule,
    ProposalModule,
    MasterSettingsModule,
    PhoneNumberModule,
    TwilioAppModule,
    TwilioWebhooksModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
