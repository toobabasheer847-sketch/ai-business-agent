export const KNOWLEDGE_DOCUMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  INDEXED: 'indexed',
  FAILED: 'failed',
} as const;

export type KnowledgeDocumentStatus =
  (typeof KNOWLEDGE_DOCUMENT_STATUS)[keyof typeof KNOWLEDGE_DOCUMENT_STATUS];

export const RAG_EMBEDDING_JOB_NAME = 'ingest-knowledge-document';
export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT_CHARS = 1_000_000;
export const KNOWLEDGE_CHUNK_SIZE = 800;
export const KNOWLEDGE_CHUNK_OVERLAP = 100;
export const KNOWLEDGE_EMBEDDING_MODEL = 'gemini-embedding-001';

export const SUPPORTED_KNOWLEDGE_EXTENSIONS = ['.pdf', '.txt', '.docx'] as const;

export const SUPPORTED_KNOWLEDGE_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
] as const;
