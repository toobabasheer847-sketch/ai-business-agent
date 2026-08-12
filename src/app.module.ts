import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { PhoneNumberModule } from './modules/phone-number/phone-number.module';
import { TwilioAppModule } from './modules/twilio-app/twilio-app.module';
import { TwilioWebhooksModule } from './webhooks/twilio/twilio-webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    InfrastructureModule,
    AuthModule,
    PhoneNumberModule,
    TwilioAppModule,
    TwilioWebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
