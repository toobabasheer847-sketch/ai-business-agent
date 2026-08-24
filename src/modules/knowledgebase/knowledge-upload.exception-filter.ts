import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

import { MAX_KNOWLEDGE_FILE_BYTES } from './knowledge-document.constants';

@Catch(MulterError, PayloadTooLargeException, HttpException)
export class KnowledgeUploadExceptionFilter implements ExceptionFilter {
  catch(
    exception: MulterError | PayloadTooLargeException | HttpException,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : undefined;
    const isTooLarge =
      exception instanceof PayloadTooLargeException ||
      status === HttpStatus.PAYLOAD_TOO_LARGE ||
      (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE');

    if (!isTooLarge && exception instanceof HttpException) {
      const body = exception.getResponse();
      response.status(exception.getStatus()).json(
        typeof body === 'string'
          ? { statusCode: exception.getStatus(), message: body }
          : body,
      );
      return;
    }

    const message = isTooLarge
      ? `File exceeds the maximum size of ${MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024)}MB.`
      : 'Invalid file upload.';

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}
