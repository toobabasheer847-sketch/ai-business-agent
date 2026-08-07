export interface RagQuery {
  query: string;
  tenantId?: string;
  topK?: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  tenantId: string;
  // Using updated schema fields:
  source?: string | null; // S3 key or URL
  sourceType?: string | null; // e.g., 'pdf', 'website'
  docType?: string | null; // MIME type
  chunkIndex?: string | number | null;
  embeddingModel?: string | null;
}

export interface RagSourceMetadata {
  chunkId: string;
  chunkIndex?: string | number | null;
  source?: string | null;
  sourceType?: string | null;
}

export interface RagResponse {
  answer: string;
  sources: RagSourceMetadata[];
  usedKnowledge: boolean;
  message?: string;
}
