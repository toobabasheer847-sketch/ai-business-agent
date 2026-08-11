import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import { AppLogger } from '../../infrastructure/logging/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const url = request.url;
    const startTime = Date.now();
    const user = request.user
      ? {
          userId: request.user.userId,
          tenantId: request.user.tenantId,
          email: request.user.email,
        }
      : undefined;
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ??
      (request.id as string | undefined);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logger.log(
            `[HTTP] ${method} ${url} ${statusCode} - ${duration}ms`,
            { requestId, userId: user?.userId, tenantId: user?.tenantId },
            user ? { user, durationMs: duration, statusCode, method, url } : { durationMs: duration, statusCode, method, url },
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `[HTTP] ${method} ${url} error after ${duration}ms`,
            { requestId, userId: user?.userId, tenantId: user?.tenantId },
            { errorName: (err as Error)?.name, durationMs: duration, method, url },
          );
        },
      }),
    );
  }
}
