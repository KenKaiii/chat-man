/**
 * Document processing for multiple file types
 */
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import type { ProcessedDocument } from './types';

export async function processDocument(
  filePath: string,
  fileName: string
): Promise<ProcessedDocument> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  let text: string;
  let pageCount: number | undefined;

  switch (extension) {
    case 'pdf':
      text = await processPDF(filePath);
      pageCount = await getPDFPageCount(filePath);
      break;

    case 'docx':
      text = await processDOCX(filePath);
      break;

    case 'txt':
    case 'md':
      text = await processText(filePath);
      break;

    case 'html':
      text = await processHTML(filePath);
      break;

    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }

  // Clean text
  text = cleanText(text);

  return {
    text,
    metadata: {
      fileName,
      fileType: extension || 'unknown',
      pageCount,
      wordCount: text.split(/\s+/).length,
      processedAt: Date.now(),
    },
  };
}

async function processPDF(filePath: string): Promise<string> {
  const dataBuffer = await readFile(filePath);
  const data = await (pdfParse as any).default(dataBuffer);
  return data.text;
}

async function getPDFPageCount(filePath: string): Promise<number> {
  const dataBuffer = await readFile(filePath);
  const data = await (pdfParse as any).default(dataBuffer);
  return data.numpages;
}

async function processDOCX(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function processText(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf-8');
}

async function processHTML(filePath: string): Promise<string> {
  const html = await readFile(filePath, 'utf-8');
  // Simple HTML tag removal
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

function cleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters (keep basic punctuation)
    .replace(/[^\w\s.,!?;:()\-'"]/g, '')
    // Trim
    .trim();
}
