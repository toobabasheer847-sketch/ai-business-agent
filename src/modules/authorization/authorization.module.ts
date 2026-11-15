import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from '../auth/auth.module';
import { AuthorizationInterceptor } from './authorization.interceptor';
import { AuthorizationService } from './authorization.service';
import { AuditLogController } from './audit-log.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditLogController],
  providers: [
    AuthorizationService,
    AuthorizationInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuthorizationInterceptor,
    },
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
