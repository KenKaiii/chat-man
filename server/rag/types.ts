/**
 * RAG TypeScript type definitions
 */

export interface VectorDocument extends Record<string, any> {
  id: string;
  vector: number[];
  text: string;
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    pageNumber?: number;
    section?: string;
    timestamp: number;
  };
}

export interface ChunkOptions {
  chunkSize: number;       // In tokens (approximately words)
  overlapPercent: number;  // 0-100
  respectBoundaries: boolean;
}

export interface Chunk {
  text: string;
  index: number;
  startToken: number;
  endToken: number;
}

export interface ProcessedDocument {
  text: string;
  metadata: {
    fileName: string;
    fileType: string;
    pageCount?: number;
    wordCount: number;
    processedAt: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
}

export interface RetrievalOptions {
  topK: number;
  documentId?: string;
  minScore?: number;
}

export interface RetrievalResult {
  chunks: VectorDocument[];
  context: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    pageNumber?: number;
    snippet: string;
  }>;
}
