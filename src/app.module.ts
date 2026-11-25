import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { AiMonitoringModule } from './ai/monitoring/ai-monitoring.module';
import { ApprovalModule } from './ai/approvals/approval.module';
import { ApprovalExecutionModule } from './ai/approvals/approval-execution.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { BrandModule } from './modules/brand/brand.module';
import { CommunicationHubModule } from './modules/communication-hub/communication-hub.module';
import { CompanyModule } from './modules/company/company.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExceptionModule } from './modules/exceptions/exception.module';
import { WorkflowModule } from './modules/workflows/workflow.module';
import { BusinessIntelligenceModule } from './modules/business-intelligence/business-intelligence.module';
import { StrategicDecisionModule } from './modules/strategic-decisions/strategic-decision.module';
import { ContinuousImprovementModule } from './modules/continuous-improvement/continuous-improvement.module';
import { CustomerFacingModule } from './modules/customer-facing/customer-facing.module';
import { GmailConfigurationModule } from './modules/gmail-configuration/gmail-configuration.module';
import { KnowledgebaseModule } from './modules/knowledgebase/knowledgebase.module';
import { LeadModule } from './modules/lead/lead.module';
import { MasterSettingsModule } from './modules/master-settings/master-settings.module';
import { MessageModule } from './modules/message/message.module';
import { PhoneNumberModule } from './modules/phone-number/phone-number.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { ProspectModule } from './modules/prospect/prospect.module';
import { TenantModule } from './modules/tenant/tenant.module';
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
    AuthorizationModule,
    TenantModule,
    UserModule,
    BrandModule,
    CompanyModule,
    LeadModule,
    ProspectModule,
    ConversationModule,
    DashboardModule,
    ExceptionModule,
    WorkflowModule,
    BusinessIntelligenceModule,
    StrategicDecisionModule,
    ContinuousImprovementModule,
    CustomerFacingModule,
    AnalyticsModule,
    MessageModule,
    CommunicationHubModule,
    GmailConfigurationModule,
    KnowledgebaseModule,
    ProposalModule,
    MasterSettingsModule,
    PhoneNumberModule,
    TwilioWebhooksModule,
    AiMonitoringModule,
    ApprovalModule,
    AiModule,
    ApprovalExecutionModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
