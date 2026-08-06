import { RagTools } from './rag.tools';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      embedContent: jest.fn().mockRejectedValue(new Error('embedding failed')),
    },
  })),
}));

jest.mock('../../../database/drizzle', () => ({
  db: {
    execute: jest.fn(),
  },
}));

describe('RagTools', () => {
  it('returns an empty knowledge result when embedding generation fails', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'GOOGLE_GENAI_API_KEY') {
          return 'test-api-key';
        }
        return fallback;
      }),
    } as any;

    const tools = new RagTools(configService);

    await expect(tools.searchKnowledge('tenant-1', 'What is the company overview?')).resolves.toEqual([]);
  });
});
