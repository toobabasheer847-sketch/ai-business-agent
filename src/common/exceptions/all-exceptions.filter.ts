import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppLogger } from '../../infrastructure/logging/logger.service';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    tenantId: string;
    email?: string;
  };
};

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const tenantId = request.user?.tenantId;
    const userId = request.user?.userId;
    const requestId = request.headers['x-request-id'] as string | undefined;
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[5xx] ${request.method} ${request.url}: ${
          typeof message === 'string' ? message : JSON.stringify(message)
        }`,
        stack,
        { tenantId, userId, requestId },
        { method: request.method, url: request.url, statusCode: status },
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(
        `[4xx] ${request.method} ${request.url}: ${
          typeof message === 'string' ? message : JSON.stringify(message)
        }`,
        { tenantId, userId, requestId },
        { method: request.method, url: request.url, statusCode: status },
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
