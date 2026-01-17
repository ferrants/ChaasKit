import * as fs from 'fs/promises';
import * as path from 'path';
import type { StorageProvider } from '../types.js';

/**
 * Filesystem storage provider - stores files on the local filesystem
 * Suitable for self-hosted deployments
 */
export class FilesystemStorageProvider implements StorageProvider {
  name = 'filesystem';
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private getFilePath(key: string): string {
    // Sanitize the key to prevent directory traversal
    const sanitizedKey = key.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '_');
    return path.join(this.basePath, sanitizedKey);
  }

  async upload(key: string, content: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content);
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);

    try {
      return await fs.readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
