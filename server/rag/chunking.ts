/**
 * Document chunking with overlap
 */
import type { ChunkOptions, Chunk } from './types';

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  chunkSize: 512,
  overlapPercent: 15,
  respectBoundaries: true,
};

export function chunkText(text: string, options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const { chunkSize, overlapPercent, respectBoundaries } = options;
  const overlapSize = Math.floor(chunkSize * (overlapPercent / 100));

  // Simple tokenization (split by whitespace)
  // For production, use tiktoken for accurate token counting
  const tokens = text.split(/\s+/).filter(t => t.length > 0);
  const chunks: Chunk[] = [];

  let position = 0;
  let chunkIndex = 0;

  while (position < tokens.length) {
    const end = Math.min(position + chunkSize, tokens.length);
    let chunkTokens = tokens.slice(position, end);

    // Respect sentence boundaries if enabled and not at document end
    if (respectBoundaries && end < tokens.length) {
      const chunkText = chunkTokens.join(' ');

      // Find last sentence boundary
      const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let lastBoundary = -1;

      for (const ending of sentenceEndings) {
        const pos = chunkText.lastIndexOf(ending);
        if (pos > lastBoundary && pos > chunkText.length * 0.7) {
          lastBoundary = pos + ending.length;
        }
      }

      if (lastBoundary > 0) {
        chunkTokens = chunkText.substring(0, lastBoundary).split(/\s+/);
      }
    }

    chunks.push({
      text: chunkTokens.join(' '),
      index: chunkIndex,
      startToken: position,
      endToken: position + chunkTokens.length,
    });

    chunkIndex++;
    position += chunkSize - overlapSize;
  }

  return chunks;
}

export function estimateTokens(text: string): number {
  // Simple estimation: ~0.75 tokens per word on average
  return Math.ceil(text.split(/\s+/).length * 0.75);
}
