import {
  DocumentParserService,
  NonRetryableIngestionError,
} from './document-parser.service';

jest.mock('pdf-parse', () =>
  jest.fn(async (buffer: Buffer) => ({
    text: buffer.toString('utf8').includes('PDF')
      ? 'Extracted PDF text content.'
      : '',
  })),
);

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(async ({ buffer }: { buffer: Buffer }) => ({
    value: buffer.toString('utf8').includes('DOCX')
      ? 'Extracted DOCX text content.'
      : '',
  })),
}));

describe('DocumentParserService', () => {
  const parser = new DocumentParserService();

  it('extracts plain text from TXT buffers', async () => {
    const text = await parser.extractText(
      'txt',
      Buffer.from('Hello knowledge base.'),
    );

    expect(text).toBe('Hello knowledge base.');
  });

  it('strips UTF-8 BOM from TXT buffers', async () => {
    const text = await parser.extractText(
      'txt',
      Buffer.from('\uFEFFBOM stripped'),
    );

    expect(text).toBe('BOM stripped');
  });

  it('extracts text from PDF buffers', async () => {
    const text = await parser.extractText(
      'pdf',
      Buffer.from('%PDF sample'),
    );

    expect(text).toBe('Extracted PDF text content.');
  });

  it('extracts text from DOCX buffers', async () => {
    const text = await parser.extractText(
      'docx',
      Buffer.from('PK DOCX sample'),
    );

    expect(text).toBe('Extracted DOCX text content.');
  });

  it('throws when extracted PDF text is empty', async () => {
    await expect(
      parser.extractText('pdf', Buffer.from('not-pdf')),
    ).rejects.toBeInstanceOf(NonRetryableIngestionError);
  });

  it('throws when extracted DOCX text is empty', async () => {
    await expect(
      parser.extractText('docx', Buffer.from('not-docx')),
    ).rejects.toBeInstanceOf(NonRetryableIngestionError);
  });

  it('wraps parser failures as NonRetryableIngestionError', async () => {
    const pdfParse = require('pdf-parse');
    pdfParse.mockRejectedValueOnce(new Error('corrupt pdf'));

    await expect(
      parser.extractText('pdf', Buffer.from('%PDF corrupt')),
    ).rejects.toMatchObject({
      name: 'NonRetryableIngestionError',
      message: expect.stringContaining('could not be parsed'),
    });
  });
});
