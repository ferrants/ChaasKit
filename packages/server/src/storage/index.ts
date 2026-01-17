import type { StorageProvider, StorageConfig } from './types.js';
import { DatabaseStorageProvider } from './providers/database.js';
import { FilesystemStorageProvider } from './providers/filesystem.js';

export type { StorageProvider, StorageConfig };

let storageProvider: StorageProvider | null = null;

/**
 * Get the configured storage provider
 */
export function getStorageProvider(config?: StorageConfig): StorageProvider {
  if (storageProvider) {
    return storageProvider;
  }

  if (!config) {
    // Default to database storage
    storageProvider = new DatabaseStorageProvider();
    return storageProvider;
  }

  switch (config.provider) {
    case 'database':
      storageProvider = new DatabaseStorageProvider();
      break;

    case 'filesystem':
      if (!config.filesystem?.basePath) {
        throw new Error('Filesystem storage requires basePath configuration');
      }
      storageProvider = new FilesystemStorageProvider(config.filesystem.basePath);
      break;

    case 's3':
      // S3 storage would be implemented here
      // For now, fall back to filesystem with a warning
      console.warn('S3 storage not yet implemented, falling back to database storage');
      storageProvider = new DatabaseStorageProvider();
      break;

    default:
      storageProvider = new DatabaseStorageProvider();
  }

  return storageProvider;
}

/**
 * Reset the storage provider (for testing)
 */
export function resetStorageProvider(): void {
  storageProvider = null;
}
