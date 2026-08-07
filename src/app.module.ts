import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaskModule } from './ai/agents/task/task.module';
import { ProposalModule } from './ai/agents/proposal/proposal.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    DatabaseModule,
    AuthModule,
    TaskModule,
    ProposalModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}