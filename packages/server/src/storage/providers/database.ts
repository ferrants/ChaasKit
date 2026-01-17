import { db } from '@chaaskit/db';
import type { StorageProvider } from '../types.js';

/**
 * Database storage provider - stores content directly in Document.content field
 * Suitable for small text documents
 */
export class DatabaseStorageProvider implements StorageProvider {
  name = 'database';

  async upload(key: string, content: Buffer, _mimeType: string): Promise<void> {
    // For database storage, the content is stored directly in the Document model
    // The key is the document ID
    // This is handled by the DocumentService when creating/updating documents
    // This method is a no-op for database storage
    const textContent = content.toString('utf-8');

    await db.document.update({
      where: { id: key },
      data: { content: textContent },
    });
  }

  async download(key: string): Promise<Buffer> {
    const doc = await db.document.findUnique({
      where: { id: key },
      select: { content: true },
    });

    if (!doc || !doc.content) {
      throw new Error(`Document not found: ${key}`);
    }

    return Buffer.from(doc.content, 'utf-8');
  }

  async delete(key: string): Promise<void> {
    // For database storage, content is deleted with the document
    // This is a no-op as the Document model handles this
    await db.document.update({
      where: { id: key },
      data: { content: null },
    });
  }
}
