/**
 * LanceDB vector database operations
 */
import { connect, Connection, Table } from 'vectordb';
import { join } from 'path';
import type { VectorDocument } from './types';
import { logger } from '../utils/secureLogger';

const DB_PATH = join(process.cwd(), 'data', 'rag-vectors');

class RAGDatabase {
  private connection: Connection | null = null;
  private table: Table | null = null;

  async connect(): Promise<void> {
    this.connection = await connect(DB_PATH);
    logger.info('Connected to LanceDB', { path: DB_PATH });
  }

  async ensureTable(): Promise<Table> {
    if (!this.connection) {
      await this.connect();
    }

    try {
      this.table = await this.connection!.openTable('documents');
      logger.debug('Opened existing documents table');
    } catch (_error) {
      // Table doesn't exist, create it
      const sampleData: VectorDocument[] = [{
        id: 'init',
        vector: Array(384).fill(0), // all-minilm is 384-dim (switched from nomic-embed-text 768-dim for faster downloads)
        text: 'Initialization document',
        metadata: {
          documentId: 'init',
          documentName: 'init',
          chunkIndex: 0,
          timestamp: Date.now(),
        },
      }];

      this.table = await this.connection!.createTable('documents', sampleData);
      logger.info('Created new documents table with 384-dim vectors');
    }

    return this.table;
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    const table = await this.ensureTable();
    await table.add(documents);
    logger.info('Added document chunks', {
      chunkCount: documents.length,
      // text content: NEVER LOGGED - may contain PHI
    });
  }

  async search(
    queryVector: number[],
    limit: number = 5
  ): Promise<VectorDocument[]> {
    const table = await this.ensureTable();
    const results = await table.search(queryVector).limit(limit).execute();
    return results as unknown as VectorDocument[];
  }

  async deleteDocument(documentId: string): Promise<void> {
    const table = await this.ensureTable();

    // Get all documents
    const allResults = await table.search(Array(768).fill(0)).limit(10000).execute();

    interface RowWithDistance {
      _distance: number;
      metadata?: { documentId: string };
      [key: string]: unknown;
    }

    // Filter out the chunks belonging to the document we want to delete
    // Also strip the _distance field to avoid schema issues
    const remainingChunks = (allResults as RowWithDistance[])
      .filter((row) => row.metadata?.documentId !== documentId)
      .map((row) => {
        const { _distance: _, ...cleanRow } = row;
        return cleanRow;
      });

    // Drop the old table and recreate with remaining chunks
    if (!this.connection) {
      await this.connect();
    }

    await this.connection!.dropTable('documents');

    // If we have remaining chunks, recreate the table with them
    if (remainingChunks.length > 0) {
      this.table = await this.connection!.createTable('documents', remainingChunks);
    } else {
      // No chunks left, create empty table with init document
      const sampleData: VectorDocument[] = [{
        id: 'init',
        vector: Array(768).fill(0),
        text: 'Initialization document',
        metadata: {
          documentId: 'init',
          documentName: 'init',
          chunkIndex: 0,
          timestamp: Date.now(),
        },
      }];
      this.table = await this.connection!.createTable('documents', sampleData);
    }

    logger.info('Deleted document', { documentId: documentId.substring(0, 8) + '...' });
  }

  async listDocuments(): Promise<string[]> {
    const table = await this.ensureTable();
    // Get all vectors (limit to a reasonable number)
    const results = await table.search(Array(768).fill(0)).limit(1000).execute();

    interface RowWithMetadata {
      metadata?: { documentId: string };
    }

    const documentIds = new Set<string>();
    for (const row of results as RowWithMetadata[]) {
      if (row.metadata?.documentId && row.metadata.documentId !== 'init') {
        documentIds.add(row.metadata.documentId);
      }
    }

    return Array.from(documentIds);
  }

  async getDocumentStats(documentId: string): Promise<{
    chunkCount: number;
    totalTokens: number;
    documentName?: string;
  }> {
    const table = await this.ensureTable();
    // Get all documents and filter in JavaScript (LanceDB filter syntax is complex for metadata)
    const allResults = await table.search(Array(768).fill(0)).limit(1000).execute();

    interface RowWithTextAndMetadata {
      text: string;
      metadata?: { documentId: string; documentName?: string };
    }

    const results = (allResults as unknown as RowWithTextAndMetadata[]).filter((row) => row.metadata?.documentId === documentId);

    // Get document name from first chunk's metadata
    const documentName = results[0]?.metadata?.documentName;

    return {
      chunkCount: results.length,
      totalTokens: results.reduce((sum, row) => sum + row.text.split(/\s+/).length, 0),
      documentName,
    };
  }
}

export const ragDatabase = new RAGDatabase();
