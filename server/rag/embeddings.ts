/**
 * Ollama embedding generation
 */
import type { EmbeddingResponse } from './types';
import { logger } from '../utils/secureLogger';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Helper to sleep for a given number of milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a cold-start EOF error that should be retried
 */
function isColdStartError(errorDetails: string): boolean {
  return errorDetails.includes('EOF') ||
         errorDetails.includes('connection') ||
         errorDetails.includes('ECONNREFUSED');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  let lastError: Error | null = null;

  // Retry loop for cold-start failures
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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

        // Check if it's a model not found error (don't retry these)
        if (response.status === 404 || errorDetails.includes('model') || errorDetails.includes('not found')) {
          throw new Error(
            `Embedding model '${EMBEDDING_MODEL}' not found. ` +
            `Please ensure Ollama is running and the model is installed. ` +
            `Run: ollama pull ${EMBEDDING_MODEL}`
          );
        }

        // Check if it's a runner process crash (Ollama internal failure)
        if (errorDetails.includes('runner process no longer running') || errorDetails.includes('llama runner process')) {
          throw new Error(
            `Ollama embedding worker process crashed. This usually indicates:\n` +
            `1. Corrupted model - Try: ollama rm ${EMBEDDING_MODEL} && ollama pull ${EMBEDDING_MODEL}\n` +
            `2. Insufficient memory - Ollama needs ~2GB free RAM\n` +
            `3. Conflicting Ollama instances - Try: killall ollama && ollama serve\n` +
            `4. Outdated Ollama version - Update from https://ollama.ai\n` +
            `Error: ${errorDetails}`
          );
        }

        // Check if it's a cold-start error (retry these)
        if (isColdStartError(errorDetails) && attempt < MAX_RETRIES) {
          logger.warn('Embedding cold-start detected, retrying...', {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            error: errorDetails,
          });
          await sleep(RETRY_DELAY_MS);
          continue; // Retry
        }

        throw new Error(`Ollama embeddings failed (${response.status}): ${errorDetails}`);
      }

      const data: EmbeddingResponse = await response.json();

      // Log successful retry if this wasn't the first attempt
      if (attempt > 0) {
        logger.info('Embedding succeeded after retry', {
          attempt: attempt + 1,
        });
      }

      return data.embedding;
    } catch (error) {
      lastError = error as Error;

      // If it's a fetch error (connection failed), retry
      if (error instanceof TypeError && attempt < MAX_RETRIES) {
        logger.warn('Embedding connection failed, retrying...', {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          error: error.message,
        });
        await sleep(RETRY_DELAY_MS);
        continue; // Retry
      }

      // Don't retry other errors
      throw error;
    }
  }

  // If we exhausted all retries, throw the last error
  throw lastError || new Error('Failed to generate embedding after retries');
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
