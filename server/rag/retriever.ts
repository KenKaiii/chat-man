/**
 * Query processing and retrieval logic
 */
import { ragDatabase } from './database';
import { generateEmbedding } from './embeddings';
import type { RetrievalOptions, RetrievalResult, VectorDocument } from './types';

export async function retrieveContext(
  query: string,
  options: RetrievalOptions = { topK: 5 }
): Promise<RetrievalResult> {
  // Generate embedding for query
  const queryVector = await generateEmbedding(query);

  // Search vector database (get more results if filtering)
  const searchLimit = options.documentId ? options.topK * 10 : options.topK;
  const allChunks = await ragDatabase.search(
    queryVector,
    searchLimit
  );

  // Filter by documentId if specified (do in JavaScript)
  const chunks = options.documentId
    ? allChunks.filter((chunk: any) => chunk.metadata?.documentId === options.documentId).slice(0, options.topK)
    : allChunks;

  // Filter by min score if specified
  const filteredChunks = options.minScore !== undefined
    ? chunks.filter((chunk: any) => chunk._distance <= options.minScore!)
    : chunks;

  // Assemble context from chunks
  const context = filteredChunks
    .map((chunk, i) => `[${i + 1}] ${chunk.text}`)
    .join('\n\n');

  // Extract sources
  const sources = filteredChunks.map((chunk, i) => ({
    documentId: chunk.metadata.documentId,
    documentName: chunk.metadata.documentName,
    chunkIndex: chunk.metadata.chunkIndex,
    pageNumber: chunk.metadata.pageNumber,
    snippet: chunk.text.substring(0, 150) + '...',
  }));

  return {
    chunks: filteredChunks,
    context,
    sources,
  };
}

export function buildRAGPrompt(query: string, context: string): string {
  return `You are a helpful assistant that answers questions based on the provided context.

Context:
${context}

Question: ${query}

Instructions:
- Answer the question using ONLY the information provided in the context above
- If the context doesn't contain enough information to answer the question, say "I don't have enough information to answer that question based on the provided documents"
- Include specific references to the context when possible (e.g., "[1] states that...")
- Be concise but complete in your answer

Answer:`;
}
