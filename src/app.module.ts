import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CommunicationHubModule } from './modules/communication-hub/communication-hub.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,
    AuthModule,
    BrandModule,
    CommunicationHubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
