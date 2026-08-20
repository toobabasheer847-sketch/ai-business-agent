import path from 'node:path';

import { BadRequestException } from '@nestjs/common';

import {
  MAX_KNOWLEDGE_FILE_BYTES,
  SUPPORTED_KNOWLEDGE_EXTENSIONS,
} from './knowledge-document.constants';

export type KnowledgeSourceType = 'pdf' | 'txt' | 'docx';

const PDF_MAGIC = Buffer.from('%PDF', 'ascii');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function sanitizeKnowledgeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') {
    throw new BadRequestException('A file name is required.');
  }

  const base = path.basename(originalName.replace(/\\/g, '/')).trim();
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !cleaned ||
    cleaned === '.' ||
    cleaned === '..' ||
    cleaned.includes('..')
  ) {
    throw new BadRequestException('Invalid file name.');
  }

  return cleaned.slice(0, 200);
}

export function getKnowledgeExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function detectKnowledgeSourceType(
  filename: string,
  buffer: Buffer,
  mimeType?: string | null,
): KnowledgeSourceType {
  const extension = getKnowledgeExtension(filename);
  if (
    !(SUPPORTED_KNOWLEDGE_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    throw new BadRequestException(
      'Unsupported file type. Upload a PDF, TXT, or DOCX file.',
    );
  }

  if (extension === '.doc') {
    throw new BadRequestException(
      'Legacy .doc files are not supported. Convert the file to DOCX and try again.',
    );
  }

  if (buffer.length === 0) {
    throw new BadRequestException('The uploaded file is empty.');
  }

  if (buffer.length > MAX_KNOWLEDGE_FILE_BYTES) {
    throw new BadRequestException(
      `File exceeds the maximum size of ${MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  if (extension === '.pdf') {
    if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
      throw new BadRequestException('File is not a valid PDF.');
    }
    return 'pdf';
  }

  if (extension === '.docx') {
    if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw new BadRequestException('File is not a valid DOCX document.');
    }
    return 'docx';
  }

  if (looksBinary(buffer)) {
    throw new BadRequestException('File is not valid plain text.');
  }

  if (
    mimeType &&
    mimeType !== 'text/plain' &&
    mimeType !== 'application/octet-stream' &&
    mimeType !== 'text/plain; charset=utf-8'
  ) {
    throw new BadRequestException('File is not valid plain text.');
  }

  return 'txt';
}

export function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
    if (byte < 7 || (byte > 14 && byte < 32)) {
      suspicious += 1;
    }
  }

  return suspicious / sample.length > 0.3;
}

export function resolveSafeStoragePath(
  rootDir: string,
  tenantId: string,
  knowledgeBaseId: string,
  documentId: string,
  filename: string,
): string {
  const sanitized = sanitizeKnowledgeFilename(filename);
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(
    resolvedRoot,
    tenantId,
    knowledgeBaseId,
    documentId,
    sanitized,
  );

  const relative = path.relative(resolvedRoot, resolved);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).includes('..')
  ) {
    throw new BadRequestException('Invalid storage path.');
  }

  return resolved;
}

export function toStorageKey(
  tenantId: string,
  knowledgeBaseId: string,
  documentId: string,
  filename: string,
): string {
  return [tenantId, knowledgeBaseId, documentId, filename].join('/');
}

export function toSafeFailureReason(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : 'Document processing failed.';

  return raw
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, '[redacted]')
    .replace(/postgresql:\/\/\S+/gi, '[redacted]')
    .replace(/redis:\/\/\S+/gi, '[redacted]')
    .slice(0, 400);
}
