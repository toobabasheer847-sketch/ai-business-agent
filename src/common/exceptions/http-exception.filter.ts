import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      error: {
        code: status,
        message: typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message ?? exception.message,
        details: typeof exceptionResponse === 'object' ? (exceptionResponse as any).error ?? (exceptionResponse as any).message : undefined,
        requestId: request.headers['x-request-id'] as string | undefined,
      },
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
