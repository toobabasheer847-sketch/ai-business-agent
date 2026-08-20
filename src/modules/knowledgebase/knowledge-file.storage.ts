import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  resolveSafeStoragePath,
  toStorageKey,
} from './knowledge-file.util';

@Injectable()
export class KnowledgeFileStorage {
  private readonly rootDir: string;

  constructor(private readonly configService: ConfigService) {
    this.rootDir = path.resolve(
      this.configService.get<string>(
        'KNOWLEDGE_STORAGE_DIR',
        path.join(process.cwd(), 'storage', 'knowledge'),
      )!,
    );
  }

  getRootDir(): string {
    return this.rootDir;
  }

  getAbsolutePath(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string,
    filename: string,
  ): string {
    return resolveSafeStoragePath(
      this.rootDir,
      tenantId,
      knowledgeBaseId,
      documentId,
      filename,
    );
  }

  getStorageKey(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string,
    filename: string,
  ): string {
    return toStorageKey(tenantId, knowledgeBaseId, documentId, filename);
  }

  async save(input: {
    tenantId: string;
    knowledgeBaseId: string;
    documentId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ absolutePath: string; storageKey: string }> {
    const absolutePath = this.getAbsolutePath(
      input.tenantId,
      input.knowledgeBaseId,
      input.documentId,
      input.filename,
    );

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      absolutePath,
      storageKey: this.getStorageKey(
        input.tenantId,
        input.knowledgeBaseId,
        input.documentId,
        input.filename,
      ),
    };
  }

  async removeDocumentDir(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string,
  ): Promise<void> {
    const dir = path.resolve(
      this.rootDir,
      tenantId,
      knowledgeBaseId,
      documentId,
    );
    const relative = path.relative(this.rootDir, dir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return;
    }

    await rm(dir, { recursive: true, force: true });
  }

  async removeKnowledgeBaseDir(
    tenantId: string,
    knowledgeBaseId: string,
  ): Promise<void> {
    const dir = path.resolve(this.rootDir, tenantId, knowledgeBaseId);
    const relative = path.relative(this.rootDir, dir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return;
    }

    await rm(dir, { recursive: true, force: true });
  }
}
