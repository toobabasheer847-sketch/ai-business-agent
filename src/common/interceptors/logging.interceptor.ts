import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const url = request.url;
    const startTime = Date.now();
    const user = request.user ? {
      userId: request.user.userId,
      tenantId: request.user.tenantId,
      email: request.user.email,
    } : undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          // eslint-disable-next-line no-console
          console.log(
            `[HTTP] ${method} ${url} ${statusCode} - ${duration}ms`,
            user ? { user } : undefined,
          );
        },
      }),
    );
  }
}
