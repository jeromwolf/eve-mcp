import fs from 'fs/promises';
import path from 'path';
import privacyLogger from './logger-privacy.js';

// Dynamic import for pdf-parse to handle ES modules
async function getPdfParse() {
  try {
    const pdfParse = await import('pdf-parse/lib/pdf-parse.js' as any);
    return pdfParse.default || pdfParse;
  } catch (error: any) {
    privacyLogger.warn('Failed to load pdf-parse, trying alternative import', { error: error.message });
    const pdfParse = await import('pdf-parse');
    return pdfParse.default || pdfParse;
  }
}

/**
 * Extract text from PDF file
 * @param pdfPath - Path to the PDF file
 * @returns Extracted text or null if extraction fails
 */
export async function extractTextFromPDF(pdfPath: string): Promise<string | null> {
  try {
    // Check if file exists
    const stats = await fs.stat(pdfPath);
    if (!stats.isFile()) {
      privacyLogger.warn('PDF path is not a file', { path: pdfPath });
      return null;
    }

    // Read PDF file
    const dataBuffer = await fs.readFile(pdfPath);
    
    // Get pdf-parse module
    const pdfParse = await getPdfParse();
    
    // Suppress warning messages during PDF parsing
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    process.stdout.write = () => true;
    process.stderr.write = (chunk: any) => {
      const str = chunk.toString();
      // Suppress PDF-related warnings but keep other errors
      if (str.includes('Warning:') || str.includes('TT:') || str.includes('Unknown/unsupported')) {
        return true;
      }
      return originalStderr.call(process.stderr, chunk);
    };
    
    // Extract text from PDF
    let data;
    try {
      data = await pdfParse(dataBuffer, {
        // Options to improve text extraction
        max: 0, // No page limit
        version: 'v2.0.550'
      });
    } finally {
      // Always restore output streams
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
    
    if (!data || !data.text) {
      privacyLogger.warn('No text extracted from PDF', { 
        path: pdfPath,
        pages: data?.numpages || 0 
      });
      return null;
    }
    
    // Clean up the extracted text
    let cleanedText = data.text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\t+/g, ' ') // Replace tabs with spaces
      .trim();
    
    // Add metadata if available
    const metadata = [];
    if (data.info?.Title) metadata.push(`Title: ${data.info.Title}`);
    if (data.info?.Author) metadata.push(`Author: ${data.info.Author}`);
    if (data.info?.Subject) metadata.push(`Subject: ${data.info.Subject}`);
    if (data.numpages) metadata.push(`Pages: ${data.numpages}`);
    
    if (metadata.length > 0) {
      cleanedText = `[PDF Metadata]\n${metadata.join('\n')}\n\n[Content]\n${cleanedText}`;
    }
    
    privacyLogger.info('PDF text extracted successfully', {
      path: pdfPath,
      pages: data.numpages || 0,
      textLength: cleanedText.length,
      hasMetadata: metadata.length > 0
    });
    
    return cleanedText;
    
  } catch (error: any) {
    privacyLogger.error('Failed to extract text from PDF', {
      path: pdfPath,
      error: error.message,
      stack: error.stack
    });
    
    // Return basic fallback text if extraction fails
    try {
      const stats = await fs.stat(pdfPath);
      const fileName = path.basename(pdfPath);
      return `[PDF Extraction Failed]\nFile: ${fileName}\nSize: ${(stats.size / 1024).toFixed(2)} KB\n\nThis PDF could not be processed. It may be a scanned document or contain non-text content.`;
    } catch (fallbackError) {
      return null;
    }
  }
}

/**
 * Extract text from multiple PDFs
 * @param pdfPaths - Array of PDF file paths
 * @returns Map of file paths to extracted text
 */
export async function extractTextFromMultiplePDFs(
  pdfPaths: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  for (const pdfPath of pdfPaths) {
    const text = await extractTextFromPDF(pdfPath);
    if (text) {
      results.set(pdfPath, text);
    }
  }
  
  privacyLogger.info('Batch PDF extraction completed', {
    total: pdfPaths.length,
    successful: results.size,
    failed: pdfPaths.length - results.size
  });
  
  return results;
}

/**
 * Extract text chunks from PDF for RAG processing
 * @param pdfPath - Path to the PDF file
 * @param chunkSize - Maximum characters per chunk (default: 1000)
 * @param overlap - Character overlap between chunks (default: 200)
 * @returns Array of text chunks
 */
export async function extractChunksFromPDF(
  pdfPath: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  const text = await extractTextFromPDF(pdfPath);
  if (!text) return [];
  
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const sentenceWithPeriod = sentence + '. ';
    
    if (currentChunk.length + sentenceWithPeriod.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // Keep last part for overlap
        const words = currentChunk.split(' ');
        const overlapWords = Math.ceil(words.length * (overlap / chunkSize));
        currentChunk = words.slice(-overlapWords).join(' ') + ' ';
      }
    }
    
    currentChunk += sentenceWithPeriod;
  }
  
  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  privacyLogger.info('PDF chunked for RAG', {
    path: pdfPath,
    chunks: chunks.length,
    avgChunkSize: chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length
  });
  
  return chunks;
}