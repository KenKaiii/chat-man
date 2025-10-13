/**
 * RAG TypeScript type definitions
 */

export interface VectorDocument {
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
  [key: string]: unknown;
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
  sessionId?: string;
  minScore?: number;
}

export interface ChunkWithDistance extends VectorDocument {
  _distance: number;
}

export interface RetrievalResult {
  chunks: ChunkWithDistance[];
  context: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    pageNumber?: number;
    snippet: string;
  }>;
}
