/**
 * RAG API endpoints
 */
import { join } from 'path';
import { unlink } from 'fs/promises';
import { ragDatabase } from './rag/database';
import { processDocument } from './rag/processor';
import { chunkText, DEFAULT_CHUNK_OPTIONS } from './rag/chunking';
import { generateEmbeddingsBatch } from './rag/embeddings';
import { retrieveContext, buildRAGPrompt } from './rag/retriever';
import { streamChat } from './ollama';

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Upload and process document
 * POST /api/rag/upload
 */
export async function handleRAGUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400, headers: CORS_HEADERS });
    }

    // Save file temporarily
    const tempPath = join(process.cwd(), 'data', 'temp', file.name);
    await Bun.write(tempPath, file);

    // Process document
    const processed = await processDocument(tempPath, file.name);

    // Chunk text
    const chunks = chunkText(processed.text, DEFAULT_CHUNK_OPTIONS);

    // Generate embeddings
    const embeddings = await generateEmbeddingsBatch(
      chunks.map(c => c.text)
    );

    // Store in vector database
    const documentId = `doc_${Date.now()}`;
    const vectorDocs = chunks.map((chunk, i) => ({
      id: `${documentId}_${i}`,
      vector: embeddings[i],
      text: chunk.text,
      metadata: {
        documentId,
        documentName: file.name,
        chunkIndex: i,
        timestamp: Date.now(),
      },
    }));

    await ragDatabase.addDocuments(vectorDocs);

    // Cleanup temp file
    await unlink(tempPath);

    return Response.json({
      success: true,
      documentId,
      stats: {
        chunks: chunks.length,
        ...processed.metadata,
      },
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('RAG upload error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Query documents
 * POST /api/rag/query
 */
export async function handleRAGQuery(req: Request): Promise<Response> {
  try {
    const { query, documentId, topK = 5 } = await req.json();

    if (!query) {
      return Response.json({ error: 'No query provided' }, { status: 400, headers: CORS_HEADERS });
    }

    // Retrieve context
    const retrieval = await retrieveContext(query, { topK, documentId });

    // Build RAG prompt
    const ragPrompt = buildRAGPrompt(query, retrieval.context);

    // Get LLM response
    let answer = '';
    for await (const chunk of streamChat('llama3.2:3b', [
      { role: 'user', content: ragPrompt }
    ])) {
      if (chunk.message?.content) {
        answer += chunk.message.content;
      }
      if (chunk.done) break;
    }

    return Response.json({
      success: true,
      query,
      answer,
      sources: retrieval.sources,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('RAG query error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * List documents
 * GET /api/rag/documents
 */
export async function handleRAGList(): Promise<Response> {
  try {
    const documentIds = await ragDatabase.listDocuments();

    const documents = await Promise.all(
      documentIds.map(async (id) => {
        const stats = await ragDatabase.getDocumentStats(id);
        return { id, ...stats };
      })
    );

    return Response.json({ success: true, documents }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('RAG list error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'List failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Delete document
 * DELETE /api/rag/documents/:id
 */
export async function handleRAGDelete(documentId: string): Promise<Response> {
  try {
    await ragDatabase.deleteDocument(documentId);
    return Response.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('RAG delete error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
