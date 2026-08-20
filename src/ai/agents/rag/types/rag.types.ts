export interface RagQueryOptions {
  topK?: number;
  knowledgeBaseId?: string;
}

export interface RagQuery {
  query: string;
  tenantId?: string;
  topK?: number;
  knowledgeBaseId?: string;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  tenantId: string;
  documentId?: string | null;
  documentName?: string | null;
  knowledgeBaseId?: string | null;
  source?: string | null;
  sourceType?: string | null;
  docType?: string | null;
  chunkIndex?: string | number | null;
  embeddingModel?: string | null;
}

export interface RagSourceMetadata {
  chunkId: string;
  chunkIndex?: string | number | null;
  documentId?: string | null;
  documentName?: string | null;
  source?: string | null;
  sourceType?: string | null;
}

export interface RagResponse {
  answer: string;
  sources: RagSourceMetadata[];
  usedKnowledge: boolean;
  message?: string;
}
