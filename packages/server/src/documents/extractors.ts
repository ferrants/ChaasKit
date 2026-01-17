/**
 * Text extraction system for documents
 * Uses a registry pattern for extensibility
 */

export interface TextExtractor {
  mimeTypes: string[];
  extract(buffer: Buffer): Promise<string>;
}

// Registry of extractors by MIME type
const extractors = new Map<string, TextExtractor>();

/**
 * Register a text extractor for specific MIME types
 */
export function registerExtractor(extractor: TextExtractor): void {
  for (const mimeType of extractor.mimeTypes) {
    extractors.set(mimeType, extractor);
  }
}

/**
 * Extract text from a buffer based on its MIME type
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  const extractor = extractors.get(mimeType);
  if (!extractor) {
    // Fall back to treating it as plain text
    return buffer.toString('utf-8');
  }
  return extractor.extract(buffer);
}

/**
 * Check if a MIME type is supported for text extraction
 */
export function isExtractorSupported(mimeType: string): boolean {
  return extractors.has(mimeType) || isPlainTextMimeType(mimeType);
}

/**
 * Check if MIME type is plain text (doesn't need extraction)
 */
function isPlainTextMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/typescript' ||
    mimeType === 'application/xml'
  );
}

// =============================================================================
// Built-in Extractors
// =============================================================================

/**
 * Plain text extractor - passthrough for text files
 */
const plainTextExtractor: TextExtractor = {
  mimeTypes: [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/html',
    'text/css',
    'text/javascript',
    'text/typescript',
    'text/xml',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
  ],
  async extract(buffer: Buffer): Promise<string> {
    return buffer.toString('utf-8');
  },
};

/**
 * CSV extractor - converts CSV to readable table format
 */
const csvExtractor: TextExtractor = {
  mimeTypes: ['text/csv', 'application/csv'],
  async extract(buffer: Buffer): Promise<string> {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      return '';
    }

    // Parse CSV manually (simple implementation)
    const rows = lines.map((line) => parseCSVLine(line));

    // Format as readable table
    if (rows.length === 0) {
      return content;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const maxDataWidth = Math.max(...dataRows.map((row) => (row[i] || '').length));
      return Math.max(header.length, maxDataWidth);
    });

    // Build table
    const separator = colWidths.map((w) => '-'.repeat(w)).join(' | ');
    const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');

    const output = [headerRow, separator];

    for (const row of dataRows) {
      const formattedRow = row.map((cell, i) => (cell || '').padEnd(colWidths[i] || 0)).join(' | ');
      output.push(formattedRow);
    }

    return output.join('\n');
  },
};

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Register built-in extractors
registerExtractor(plainTextExtractor);
registerExtractor(csvExtractor);
