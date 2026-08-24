import { Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

import {
  MAX_EXTRACTED_TEXT_CHARS,
} from './knowledge-document.constants';
import type { KnowledgeSourceType } from './knowledge-file.util';

export class NonRetryableIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableIngestionError';
  }
}

@Injectable()
export class DocumentParserService {
  async extractText(
    sourceType: KnowledgeSourceType,
    buffer: Buffer,
  ): Promise<string> {
    try {
      if (sourceType === 'pdf') {
        return this.normalize(await this.extractPdf(buffer));
      }
      if (sourceType === 'docx') {
        return this.normalize(await this.extractDocx(buffer));
      }
      return this.normalize(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
      if (error instanceof NonRetryableIngestionError) {
        throw error;
      }

      throw new NonRetryableIngestionError(
        'The document could not be parsed. It may be corrupted or invalid.',
      );
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const result = await pdfParse(buffer);
    return result.text ?? '';
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? '';
  }

  private normalize(text: string): string {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();

    if (!normalized) {
      throw new NonRetryableIngestionError(
        'No text could be extracted from the document.',
      );
    }

    if (normalized.length > MAX_EXTRACTED_TEXT_CHARS) {
      return normalized.slice(0, MAX_EXTRACTED_TEXT_CHARS);
    }

    return normalized;
  }
}
