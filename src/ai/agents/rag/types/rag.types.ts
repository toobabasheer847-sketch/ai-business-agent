export interface RagQuery {
  query: string;
  tenantId?: string;
  knowledgeBaseId?: string;
  topK?: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  documentId: string;
  knowledgeBaseId: string;
  tenantId: string;
  chunkIndex: number;
  documentTitle?: string | null;
  documentSource?: string | null;
}

export interface RagSourceMetadata {
  documentId: string;
  knowledgeBaseId: string;
  chunkId: string;
  chunkIndex: number;
  documentTitle?: string | null;
  documentSource?: string | null;
}

export interface RagResponse {
  answer: string;
  sources: RagSourceMetadata[];
  usedKnowledge: boolean;
  message?: string;
}
