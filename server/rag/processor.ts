/**
 * Document processing for multiple file types
 */
import { PDFParse } from 'pdf-parse/node';
import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import scribe from 'scribe.js-ocr';
import type { ProcessedDocument } from './types';

export async function processDocument(
  filePath: string,
  fileName: string
): Promise<ProcessedDocument> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  let text: string;
  let pageCount: number | undefined;

  switch (extension) {
    case 'pdf': {
      const pdfResult = await processPDF(filePath);
      text = pdfResult.text;
      pageCount = pdfResult.pageCount;
      break;
    }

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

async function processPDF(filePath: string): Promise<{ text: string; pageCount: number }> {
  const dataBuffer = await readFile(filePath);
  const pdf = new PDFParse({ data: dataBuffer });

  try {
    const textResult = await pdf.getText();
    const info = await pdf.getInfo();

    // Concatenate all page texts
    const fullText = textResult.pages.map(page => page.text).join('\n\n');

    // Check if PDF has meaningful text (digital PDF vs scanned)
    // If text is too short, it's likely a scanned PDF
    if (fullText.trim().length < 50) {
      console.log('PDF appears to be scanned (minimal text found), attempting OCR...');

      try {
        const ocrText = await scribe.extractText([filePath]);
        await scribe.terminate(); // Clean up scribe resources

        if (ocrText && ocrText.trim().length > 0) {
          console.log(`OCR successful: extracted ${ocrText.length} characters`);
          return {
            text: ocrText,
            pageCount: info.total
          };
        }
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
        // Fall through to return the minimal text we got from pdf-parse
      }
    }

    return {
      text: fullText,
      pageCount: info.total
    };
  } finally {
    await pdf.destroy();
  }
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
