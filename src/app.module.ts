import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaskModule } from './ai/agents/task/task.module';
import { ProposalModule } from './ai/agents/proposal/proposal.module';
import { AiModule } from './ai/ai.module';
import { TwilioWebhooksModule } from './webhooks/twilio/twilio-webhooks.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    InfrastructureModule,
    AuthModule,
    TaskModule,
    ProposalModule,
    AiModule,
    TwilioWebhooksModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
