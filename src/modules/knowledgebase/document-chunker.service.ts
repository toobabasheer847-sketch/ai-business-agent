import { Injectable } from '@nestjs/common';

import {
  KNOWLEDGE_CHUNK_OVERLAP,
  KNOWLEDGE_CHUNK_SIZE,
} from './knowledge-document.constants';

@Injectable()
export class DocumentChunkerService {
  chunk(text: string): string[] {
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      return [];
    }
    const paragraphs = normalized.split(/\n\n+/);
    const chunks: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

      if (candidate.length <= KNOWLEDGE_CHUNK_SIZE) {
        current = candidate;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      if (paragraph.length <= KNOWLEDGE_CHUNK_SIZE) {
        current = paragraph;
        continue;
      }

      chunks.push(...this.splitBySize(paragraph));
      current = '';
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }

  private splitBySize(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + KNOWLEDGE_CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end).trim());
      if (end >= text.length) {
        break;
      }
      start = Math.max(0, end - KNOWLEDGE_CHUNK_OVERLAP);
    }

    return chunks.filter(Boolean);
  }
}
