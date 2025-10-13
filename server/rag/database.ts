/**
 * LanceDB vector database operations
 */
import { connect, Connection, Table } from 'vectordb';
import { join } from 'path';
import type { VectorDocument } from './types';

const DB_PATH = join(process.cwd(), 'data', 'rag-vectors');

class RAGDatabase {
  private connection: Connection | null = null;
  private table: Table | null = null;

  async connect(): Promise<void> {
    this.connection = await connect(DB_PATH);
    console.log('✅ Connected to LanceDB at:', DB_PATH);
  }

  async ensureTable(): Promise<Table> {
    if (!this.connection) {
      await this.connect();
    }

    try {
      this.table = await this.connection!.openTable('documents');
      console.log('✅ Opened existing documents table');
    } catch (error) {
      // Table doesn't exist, create it
      const sampleData: VectorDocument[] = [{
        id: 'init',
        vector: Array(768).fill(0), // nomic-embed-text is 768-dim
        text: 'Initialization document',
        metadata: {
          documentId: 'init',
          documentName: 'init',
          chunkIndex: 0,
          timestamp: Date.now(),
        },
      }];

      this.table = await this.connection!.createTable('documents', sampleData);
      console.log('✅ Created new documents table');
    }

    return this.table;
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    const table = await this.ensureTable();
    await table.add(documents);
    console.log(`✅ Added ${documents.length} document chunks`);
  }

  async search(
    queryVector: number[],
    limit: number = 5
  ): Promise<VectorDocument[]> {
    const table = await this.ensureTable();
    const results = await table.search(queryVector).limit(limit).execute();
    return results as any as VectorDocument[];
  }

  async deleteDocument(documentId: string): Promise<void> {
    const table = await this.ensureTable();

    // Get all documents
    const allResults = await table.search(Array(768).fill(0)).limit(10000).execute();

    // Filter out the chunks belonging to the document we want to delete
    // Also strip the _distance field to avoid schema issues
    const remainingChunks = (allResults as any[])
      .filter((row: any) => row.metadata?.documentId !== documentId)
      .map((row: any) => {
        const { _distance, ...cleanRow } = row;
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

    console.log(`✅ Deleted document: ${documentId}`);
  }

  async listDocuments(): Promise<string[]> {
    const table = await this.ensureTable();
    // Get all vectors (limit to a reasonable number)
    const results = await table.search(Array(768).fill(0)).limit(1000).execute();

    const documentIds = new Set<string>();
    for (const row of results as any[]) {
      if (row.metadata?.documentId && row.metadata.documentId !== 'init') {
        documentIds.add(row.metadata.documentId);
      }
    }

    return Array.from(documentIds);
  }

  async getDocumentStats(documentId: string): Promise<{
    chunkCount: number;
    totalTokens: number;
  }> {
    const table = await this.ensureTable();
    // Get all documents and filter in JavaScript (LanceDB filter syntax is complex for metadata)
    const allResults = await table.search(Array(768).fill(0)).limit(1000).execute();
    const results = (allResults as any[]).filter((row: any) => row.metadata?.documentId === documentId);

    return {
      chunkCount: results.length,
      totalTokens: results.reduce((sum: number, row: any) => sum + row.text.split(/\s+/).length, 0),
    };
  }
}

export const ragDatabase = new RAGDatabase();
