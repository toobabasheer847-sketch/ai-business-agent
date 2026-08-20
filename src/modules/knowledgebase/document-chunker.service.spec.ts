import { DocumentChunkerService } from './document-chunker.service';
import {
  KNOWLEDGE_CHUNK_OVERLAP,
  KNOWLEDGE_CHUNK_SIZE,
} from './knowledge-document.constants';

describe('DocumentChunkerService', () => {
  const chunker = new DocumentChunkerService();

  it('returns an empty array for empty content', () => {
    expect(chunker.chunk('')).toEqual([]);
    expect(chunker.chunk('   ')).toEqual([]);
  });

  it('returns a single chunk for short documents', () => {
    const text = 'Short document body.';
    expect(chunker.chunk(text)).toEqual([text]);
  });

  it('creates multiple chunks for long paragraph-free text', () => {
    const text = 'A'.repeat(KNOWLEDGE_CHUNK_SIZE * 2 + 50);
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNK_SIZE);
    }
  });

  it('respects paragraph boundaries when possible', () => {
    const paragraphA = 'Paragraph A '.repeat(20).trim();
    const paragraphB = 'Paragraph B '.repeat(20).trim();
    const text = `${paragraphA}\n\n${paragraphB}`;
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join('\n\n')).toContain('Paragraph A');
    expect(chunks.join('\n\n')).toContain('Paragraph B');
  });

  it('applies overlap when splitting oversized paragraphs', () => {
    const text = 'X'.repeat(KNOWLEDGE_CHUNK_SIZE * 3);
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(2);

    for (let index = 1; index < chunks.length; index += 1) {
      const previous = chunks[index - 1];
      const current = chunks[index];
      const overlap = previous.slice(-KNOWLEDGE_CHUNK_OVERLAP);
      expect(current.startsWith(overlap.slice(0, Math.min(overlap.length, 20)))).toBe(
        true,
      );
    }
  });
});
