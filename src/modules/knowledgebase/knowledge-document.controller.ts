import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { MAX_KNOWLEDGE_FILE_BYTES } from './knowledge-document.constants';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeUploadExceptionFilter } from './knowledge-upload.exception-filter';

@UseGuards(JwtAuthGuard)
@UseFilters(KnowledgeUploadExceptionFilter)
@Controller('knowledgebases/:knowledgeBaseId/documents')
export class KnowledgeDocumentController {
  constructor(
    private readonly knowledgeDocumentService: KnowledgeDocumentService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * GET /api/knowledgebases/:knowledgeBaseId/documents
   */
  @Get()
  async list(
    @Req() req: Request,
    @Param('knowledgeBaseId', ParseUUIDPipe) knowledgeBaseId: string,
  ) {
    return this.knowledgeDocumentService.list(
      this.getTenantId(req),
      knowledgeBaseId,
    );
  }

  /**
   * POST /api/knowledgebases/:knowledgeBaseId/documents
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseFilters(KnowledgeUploadExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_KNOWLEDGE_FILE_BYTES,
        files: 1,
      },
    }),
  )
  async upload(
    @Req() req: Request,
    @Param('knowledgeBaseId', ParseUUIDPipe) knowledgeBaseId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.knowledgeDocumentService.upload(
      this.getTenantId(req),
      knowledgeBaseId,
      file,
    );
  }

  /**
   * POST /api/knowledgebases/:knowledgeBaseId/documents/:documentId/retry
   */
  @Post(':documentId/retry')
  async retry(
    @Req() req: Request,
    @Param('knowledgeBaseId', ParseUUIDPipe) knowledgeBaseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.knowledgeDocumentService.retry(
      this.getTenantId(req),
      knowledgeBaseId,
      documentId,
    );
  }

  /**
   * DELETE /api/knowledgebases/:knowledgeBaseId/documents/:documentId
   */
  @Delete(':documentId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('knowledgeBaseId', ParseUUIDPipe) knowledgeBaseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.knowledgeDocumentService.remove(
      this.getTenantId(req),
      knowledgeBaseId,
      documentId,
    );
  }
}
