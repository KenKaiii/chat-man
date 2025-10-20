/**
 * Ollama embedding generation
 */
import type { EmbeddingResponse } from './types';
import { logger } from '../utils/secureLogger';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text';

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    // Try to get detailed error message from response
    let errorDetails = response.statusText;
    try {
      const errorBody = await response.text();
      if (errorBody) {
        errorDetails = errorBody;
      }
    } catch (_e) {
      // Ignore parse errors
    }

    // Check if it's a model not found error
    if (response.status === 404 || errorDetails.includes('model') || errorDetails.includes('not found')) {
      throw new Error(
        `Embedding model '${EMBEDDING_MODEL}' not found. ` +
        `Please ensure Ollama is running and the model is installed. ` +
        `Run: ollama pull ${EMBEDDING_MODEL}`
      );
    }

    throw new Error(`Ollama embeddings failed (${response.status}): ${errorDetails}`);
  }

  const data: EmbeddingResponse = await response.json();
  return data.embedding;
}

export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 10
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);

    // Progress logging (safe - only counts, no content)
    logger.debug('Generated embeddings', {
      progress: `${Math.min(i + batchSize, texts.length)}/${texts.length}`,
      // text content: NEVER LOGGED
    });
  }

  return embeddings;
}
