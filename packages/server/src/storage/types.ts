/**
 * Storage provider interface for document storage
 */
export interface StorageProvider {
  name: string;

  /**
   * Upload content to storage
   */
  upload(key: string, content: Buffer, mimeType: string): Promise<void>;

  /**
   * Download content from storage
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete content from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Get a URL for the content (optional, for S3 presigned URLs)
   */
  getUrl?(key: string, expiresIn?: number): Promise<string>;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  provider: 'database' | 'filesystem' | 's3';
  filesystem?: {
    basePath: string;
  };
  s3?: {
    bucket: string;
    region: string;
    endpoint?: string;
  };
}
