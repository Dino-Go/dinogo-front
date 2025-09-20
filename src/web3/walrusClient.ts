'use client';

import type { SuiClient } from '@mysten/sui/client';

// Configuration types
export interface WalrusClientConfig {
  network: 'testnet' | 'mainnet';
  suiClient: SuiClient;
  storageNodeOptions?: {
    timeout?: number;
    rateLimitRetries?: number;
    customFetch?: typeof fetch;
  };
}

export interface UploadOptions {
  file: File | Blob;
  epochs?: number;
  force?: boolean;
}

export interface UploadResult {
  blobId: string;
  certificateId: string;
  endEpoch: number;
  suiRef: string;
}

export interface FileInfo {
  blobId: string;
  size: number;
  encoding?: string;
  mimeType?: string;
}

// Constants based on suiShare implementation
const PUBLISH_URL = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

/**
 * Walrus Client for decentralized file storage
 * Based on suiShare implementation patterns
 *
 * Key Features:
 * - Upload files to Walrus decentralized storage
 * - Download files using blob IDs
 * - Manage file lifecycle and storage epochs
 * - Browser-friendly file operations
 *
 * Usage:
 * ```tsx
 * const walrusClient = new WalrusClientManager({
 *   network: 'testnet',
 *   suiClient
 * });
 *
 * const result = await walrusClient.uploadFile({
 *   file: selectedFile,
 *   epochs: 10
 * });
 * ```
 */
export class WalrusClientManager {
  private suiClient: SuiClient;
  private network: string;
  private publishUrl: string;
  private aggregatorUrl: string;

  constructor(config: WalrusClientConfig) {
    this.suiClient = config.suiClient;
    this.network = config.network;
    this.publishUrl = config.network === 'testnet' ? PUBLISH_URL : PUBLISH_URL; // Update for mainnet when available
    this.aggregatorUrl = config.network === 'testnet' ? AGGREGATOR_URL : AGGREGATOR_URL;
  }

  /**
   * Upload a single file to Walrus storage
   * Based on suiShare storeBlob implementation
   */
  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    try {
      const { file, epochs = 5, force = false } = options;

      // Convert file to buffer as in suiShare
      const fileBuffer = await file.arrayBuffer();

      // Upload using direct HTTP request similar to suiShare
      const result = await this.storeBlob(fileBuffer, epochs, force);

      return this.parseStorageInfo(result, file.type);
    } catch (error) {
      console.error('Error uploading file to Walrus:', error);
      throw new Error(`Walrus upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store blob using HTTP request (suiShare pattern)
   */
  private async storeBlob(data: ArrayBuffer, epochs: number, force: boolean = false): Promise<any> {
    let url = `${this.publishUrl}/v1/blobs?epochs=${epochs}`;
    if (force) {
      url += '&force=true';
    }

    const response = await fetch(url, {
      method: 'PUT',
      body: data,
      headers: {
        'Content-Type': 'application/octet-stream',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Walrus upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Walrus response:', result);
    return result;
  }

  /**
   * Parse storage info from Walrus response (suiShare pattern)
   */
  private parseStorageInfo(storageInfo: any, _mediaType: string): UploadResult {
    const SUI_VIEW_TX_URL = `https://suiscan.xyz/testnet/tx`;
    const SUI_VIEW_OBJECT_URL = `https://suiscan.xyz/testnet/object`;

    if (!storageInfo) {
      throw new Error('Storage info is undefined - Walrus upload may have failed');
    }

    console.log('Parsing storage info:', JSON.stringify(storageInfo, null, 2));

    if ('alreadyCertified' in storageInfo) {
      return {
        blobId: storageInfo.alreadyCertified.blobId,
        certificateId: storageInfo.alreadyCertified.event?.txDigest || storageInfo.alreadyCertified.blobId,
        endEpoch: parseInt(storageInfo.alreadyCertified.endEpoch),
        suiRef: `${SUI_VIEW_TX_URL}/${storageInfo.alreadyCertified.event?.txDigest || storageInfo.alreadyCertified.blobId}`
      };
    } else if ('newlyCreated' in storageInfo) {
      return {
        blobId: storageInfo.newlyCreated.blobObject.blobId,
        certificateId: storageInfo.newlyCreated.blobObject.id,
        endEpoch: parseInt(storageInfo.newlyCreated.blobObject.storage.endEpoch),
        suiRef: `${SUI_VIEW_OBJECT_URL}/${storageInfo.newlyCreated.blobObject.id}`
      };
    } else {
      // Log the actual structure to understand what we're getting
      console.error('Unknown response structure from Walrus:', storageInfo);
      throw new Error(`Unhandled successful response from Walrus. Response structure: ${JSON.stringify(Object.keys(storageInfo))}`);
    }
  }

  /**
   * Upload multiple files as a quilt
   */
  async uploadFiles(files: File[], epochs: number = 5): Promise<UploadResult[]> {
    try {
      const uploadPromises = files.map(file =>
        this.uploadFile({ file, epochs })
      );

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw error;
    }
  }

  /**
   * Download a file by blob ID
   * Based on suiShare downloadAndDecrypt pattern
   */
  async downloadFile(blobId: string): Promise<Uint8Array> {
    try {
      // Download using direct HTTP request similar to suiShare
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;
      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error('Error downloading file from Walrus:', error);
      throw new Error(`Walrus download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download file as blob with MIME type
   */
  async downloadFileAsBlob(blobId: string, mimeType?: string): Promise<Blob> {
    try {
      const fileData = await this.downloadFile(blobId);
      // Create a new ArrayBuffer to ensure compatibility
      const buffer = new ArrayBuffer(fileData.length);
      const view = new Uint8Array(buffer);
      view.set(fileData);
      return new Blob([buffer], { type: mimeType || 'application/octet-stream' });
    } catch (error) {
      console.error('Error downloading file as blob:', error);
      throw error;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(blobId: string): Promise<FileInfo> {
    try {
      // Note: This would require additional API calls to get metadata
      // For now, return basic info structure
      return {
        blobId,
        size: 0, // Would be fetched from storage node
        encoding: 'binary',
        mimeType: 'application/octet-stream'
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  /**
   * Check if a blob exists
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload text content directly
   */
  async uploadText(text: string, epochs: number = 5): Promise<UploadResult> {
    try {
      const textBlob = new Blob([text], { type: 'text/plain' });
      return await this.uploadFile({ file: textBlob, epochs });
    } catch (error) {
      console.error('Error uploading text:', error);
      throw error;
    }
  }

  /**
   * Download text content
   */
  async downloadText(blobId: string): Promise<string> {
    try {
      const fileData = await this.downloadFile(blobId);
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(fileData);
    } catch (error) {
      console.error('Error downloading text:', error);
      throw error;
    }
  }

  /**
   * Upload JSON data
   */
  async uploadJSON(data: any, epochs: number = 5): Promise<UploadResult> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const jsonBlob = new Blob([jsonString], { type: 'application/json' });
      return await this.uploadFile({ file: jsonBlob, epochs });
    } catch (error) {
      console.error('Error uploading JSON:', error);
      throw error;
    }
  }

  /**
   * Download and parse JSON data
   */
  async downloadJSON<T = any>(blobId: string): Promise<T> {
    try {
      const textContent = await this.downloadText(blobId);
      return JSON.parse(textContent) as T;
    } catch (error) {
      console.error('Error downloading JSON:', error);
      throw error;
    }
  }

  /**
   * Get network configuration
   */
  getNetworkConfig() {
    return {
      network: this.network,
      suiClient: this.suiClient
    };
  }
}

/**
 * React hook for Walrus client
 */
export function useWalrusClient(suiClient: SuiClient, network: 'testnet' | 'mainnet' = 'testnet') {
  const walrusClient = new WalrusClientManager({
    network,
    suiClient
  });

  return {
    walrusClient,
    uploadFile: (options: UploadOptions) => walrusClient.uploadFile(options),
    uploadFiles: (files: File[], epochs?: number) => walrusClient.uploadFiles(files, epochs),
    downloadFile: (blobId: string) => walrusClient.downloadFile(blobId),
    downloadFileAsBlob: (blobId: string, mimeType?: string) =>
      walrusClient.downloadFileAsBlob(blobId, mimeType),
    uploadText: (text: string, epochs?: number) => walrusClient.uploadText(text, epochs),
    downloadText: (blobId: string) => walrusClient.downloadText(blobId),
    uploadJSON: (data: any, epochs?: number) => walrusClient.uploadJSON(data, epochs),
    downloadJSON: <T = any>(blobId: string) => walrusClient.downloadJSON<T>(blobId),
    blobExists: (blobId: string) => walrusClient.blobExists(blobId),
    getFileInfo: (blobId: string) => walrusClient.getFileInfo(blobId)
  };
}

/**
 * Utility functions for file handling
 */
export const WalrusUtils = {
  /**
   * Validate file size and type
   */
  validateFile: (file: File, maxSize: number = 50 * 1024 * 1024) => {
    if (file.size > maxSize) {
      throw new Error(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
    }
    return true;
  },

  /**
   * Generate file preview for images
   */
  generatePreview: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Calculate estimated storage cost
   */
  estimateStorageCost: (fileSizeBytes: number, epochs: number) => {
    // This would be based on current Walrus pricing
    // Placeholder calculation
    const costPerBytePerEpoch = 0.0001;
    return fileSizeBytes * epochs * costPerBytePerEpoch;
  }
};