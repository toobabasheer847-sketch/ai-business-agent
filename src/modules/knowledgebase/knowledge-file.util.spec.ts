import { BadRequestException } from '@nestjs/common';

import {
  detectKnowledgeSourceType,
  looksBinary,
  sanitizeKnowledgeFilename,
  toSafeFailureReason,
  toStorageKey,
} from './knowledge-file.util';

describe('knowledge-file.util', () => {
  it('sanitizes unsafe filenames', () => {
    expect(sanitizeKnowledgeFilename('  report final.pdf  ')).toBe(
      'report final.pdf',
    );
    expect(sanitizeKnowledgeFilename('..\\evil\\notes.txt')).toBe('notes.txt');
  });

  it('rejects invalid filenames', () => {
    expect(() => sanitizeKnowledgeFilename('')).toThrow(BadRequestException);
    expect(() => sanitizeKnowledgeFilename('..')).toThrow(BadRequestException);
  });

  it('detects supported TXT files', () => {
    const buffer = Buffer.from('plain text content');
    expect(detectKnowledgeSourceType('notes.txt', buffer, 'text/plain')).toBe(
      'txt',
    );
  });

  it('detects valid PDF magic bytes', () => {
    const buffer = Buffer.concat([
      Buffer.from('%PDF-1.4'),
      Buffer.alloc(32, 0x20),
    ]);

    expect(detectKnowledgeSourceType('file.pdf', buffer)).toBe('pdf');
  });

  it('detects valid DOCX zip magic bytes', () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

    expect(detectKnowledgeSourceType('file.docx', buffer)).toBe('docx');
  });

  it('rejects unsupported extensions', () => {
    expect(() =>
      detectKnowledgeSourceType('image.png', Buffer.from('PNG')),
    ).toThrow(BadRequestException);
  });

  it('rejects legacy .doc files', () => {
    expect(() =>
      detectKnowledgeSourceType('legacy.doc', Buffer.from('doc')),
    ).toThrow(BadRequestException);
  });

  it('rejects empty uploads', () => {
    expect(() => detectKnowledgeSourceType('empty.txt', Buffer.alloc(0))).toThrow(
      BadRequestException,
    );
  });

  it('identifies binary-looking buffers', () => {
    expect(looksBinary(Buffer.from([0x00, 0x01, 0x02]))).toBe(true);
    expect(looksBinary(Buffer.from('plain text'))).toBe(false);
  });

  it('builds tenant-scoped storage keys', () => {
    expect(
      toStorageKey('tenant-a', 'kb-1', 'doc-1', 'notes.txt'),
    ).toBe('tenant-a/kb-1/doc-1/notes.txt');
  });

  it('redacts secrets from failure reasons', () => {
    const reason = toSafeFailureReason(
      new Error('Failed postgresql://user:pass@host/db with Bearer abc.def'),
    );

    expect(reason).not.toContain('postgresql://');
    expect(reason).not.toContain('Bearer');
    expect(reason).toContain('[redacted]');
  });
});
