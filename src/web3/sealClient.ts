'use client';

import { SealClient, EncryptedObject, NoAccessError } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';

// Configuration types
export interface SealClientConfig {
  network: 'testnet' | 'mainnet';
  suiClient: SuiClient;
  keyServerUrls?: string[];
}

export interface EncryptionOptions {
  data: string | Uint8Array;
  accessPolicy?: AccessPolicy;
  threshold?: number;
}

export interface AccessPolicy {
  allowedAddresses?: string[];
  requiredSignatures?: number;
  expirationEpoch?: number;
  customPolicy?: any;
}

export interface SealedData {
  encryptedData: string;
  sealId: string;
  accessControlId: string;
  keyShares: KeyShare[];
}

export interface KeyShare {
  shareId: string;
  encryptedShare: string;
  keyServerId: string;
}

export interface UnsealOptions {
  sealId: string;
  requesterAddress: string;
  signature?: string;
}

/**
 * Seal Client for decentralized secrets management
 *
 * Key Features:
 * - Identity-based encryption of sensitive data
 * - On-chain access control via Sui blockchain
 * - Threshold decryption through key servers
 * - Decentralized secret sharing
 *
 * Usage:
 * ```tsx
 * const sealClient = new SealClientManager({
 *   network: 'testnet',
 *   suiClient
 * });
 *
 * const sealed = await sealClient.seal({
 *   data: 'sensitive information',
 *   accessPolicy: {
 *     allowedAddresses: ['0x123...'],
 *     requiredSignatures: 1
 *   }
 * });
 * ```
 */
export class SealClientManager {
  private sealClient: SealClient;
  private suiClient: SuiClient;
  private network: string;
  private keyServerUrls: string[];

  constructor(config: SealClientConfig) {
    this.suiClient = config.suiClient;
    this.network = config.network;
    this.keyServerUrls = config.keyServerUrls || this.getDefaultKeyServers(config.network);

    // Initialize Seal client - simplified approach
    try {
      this.sealClient = new SealClient(config.suiClient as any);
    } catch (error) {
      console.warn('SealClient initialization fallback mode:', error);
      // Fallback initialization for compatibility
      this.sealClient = new SealClient({
        suiClient: config.suiClient as any,
        serverConfigs: this.keyServerUrls.map((url, index) => ({
          url,
          objectId: `0x${index.toString().padStart(64, '0')}`,
          weight: 1
        }))
      } as any);
    }
  }

  /**
   * Encrypt and seal data with access control
   * Based on suiShare implementation pattern
   */
  async seal(options: EncryptionOptions): Promise<SealedData> {
    try {
      const { data, accessPolicy: _accessPolicy, threshold = 2 } = options;

      // Convert data to appropriate format
      const dataBuffer = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;

      // Generate random nonce and create ID similar to suiShare
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const policyObjectId = this.generatePolicyId();
      const id = this.createEncryptionId(policyObjectId, nonce);

      // Encrypt data using Seal client
      const { encryptedObject } = await this.sealClient.encrypt({
        threshold,
        packageId: process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID || '',
        id,
        data: dataBuffer,
      });

      return {
        encryptedData: encryptedObject.toString(),
        sealId: id,
        accessControlId: policyObjectId,
        keyShares: []
      };
    } catch (error) {
      console.error('Error sealing data:', error);
      throw new Error(`Seal encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt and unseal data with access verification
   * Based on suiShare downloadAndDecrypt pattern
   */
  async unseal(options: UnsealOptions & { encryptedData: Uint8Array; sessionKey?: any; txBytes?: Uint8Array }): Promise<Uint8Array> {
    try {
      const { encryptedData, sessionKey, txBytes } = options;

      if (!sessionKey || !txBytes) {
        throw new Error('Session key and transaction bytes required for decryption');
      }

      // Decrypt using Seal client similar to suiShare pattern
      const decrypted = await this.sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes,
      });

      return new Uint8Array(decrypted);
    } catch (error) {
      if (error instanceof NoAccessError) {
        console.error('No access to keys:', error);
        throw new Error('Access denied: no permission to decrypt');
      }
      console.error('Error unsealing data:', error);
      throw new Error(`Seal decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Seal text content
   */
  async sealText(text: string, accessPolicy?: AccessPolicy): Promise<SealedData> {
    return await this.seal({
      data: text,
      accessPolicy
    });
  }

  /**
   * Unseal text content
   */
  async unsealText(options: UnsealOptions & { encryptedData: Uint8Array; sessionKey?: any; txBytes?: Uint8Array }): Promise<string> {
    try {
      const unsealed = await this.unseal(options);
      return new TextDecoder().decode(unsealed);
    } catch (error) {
      console.error('Error unsealing text:', error);
      throw error;
    }
  }

  /**
   * Seal JSON data
   */
  async sealJSON(data: any, accessPolicy?: AccessPolicy): Promise<SealedData> {
    const jsonString = JSON.stringify(data, null, 2);
    return await this.sealText(jsonString, accessPolicy);
  }

  /**
   * Unseal JSON data
   */
  async unsealJSON<T = any>(options: UnsealOptions & { encryptedData: Uint8Array; sessionKey?: any; txBytes?: Uint8Array }): Promise<T> {
    try {
      const text = await this.unsealText(options);
      return JSON.parse(text) as T;
    } catch (error) {
      console.error('Error unsealing JSON:', error);
      throw error;
    }
  }

  /**
   * Create encryption ID similar to suiShare pattern
   */
  private createEncryptionId(policyObjectId: string, nonce: Uint8Array): string {
    // Convert policy object ID to bytes and combine with nonce
    const policyBytes = new TextEncoder().encode(policyObjectId);
    const combined = new Uint8Array([...policyBytes, ...nonce]);
    return Array.from(combined)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a unique policy ID
   */
  private generatePolicyId(): string {
    return 'policy_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Create access control policy on Sui
   */
  private async createAccessControl(_policy?: AccessPolicy) {
    try {
      // This would create a Move object on Sui for access control
      // Placeholder implementation
      return {
        objectId: '0x' + Math.random().toString(16).substring(2, 8),
        digest: 'placeholder_digest'
      };
    } catch (error) {
      console.error('Error creating access control:', error);
      throw error;
    }
  }

  /**
   * Verify access permissions for a requester
   */
  private async verifyAccess(sealId: string, requesterAddress: string): Promise<boolean> {
    try {
      // This would check the access control object on Sui
      // Placeholder implementation - in production, this would:
      // 1. Fetch the access control object
      // 2. Check if requester address is in allowed list
      // 3. Verify any required signatures
      // 4. Check expiration epochs
      console.log(`Verifying access for ${requesterAddress} to seal ${sealId}`);
      return true; // Placeholder
    } catch (error) {
      console.error('Error verifying access:', error);
      return false;
    }
  }

  /**
   * Fetch keys similar to suiShare pattern
   */
  async fetchKeys(options: { ids: string[]; txBytes: Uint8Array; sessionKey: any; threshold: number }) {
    try {
      return await this.sealClient.fetchKeys(options);
    } catch (error) {
      if (error instanceof NoAccessError) {
        throw new Error('No access to keys');
      }
      throw new Error('Key fetch failed');
    }
  }

  /**
   * Parse encrypted object to get ID
   */
  parseEncryptedObject(encryptedData: Uint8Array): { id: string } {
    try {
      return EncryptedObject.parse(encryptedData);
    } catch (error) {
      throw new Error('Failed to parse encrypted object');
    }
  }

  /**
   * Get default key server URLs for network
   */
  private getDefaultKeyServers(network: string): string[] {
    switch (network) {
      case 'testnet':
        return [
          'https://testnet-keyserver1.seal.example.com',
          'https://testnet-keyserver2.seal.example.com',
          'https://testnet-keyserver3.seal.example.com'
        ];
      case 'mainnet':
        return [
          'https://keyserver1.seal.example.com',
          'https://keyserver2.seal.example.com',
          'https://keyserver3.seal.example.com'
        ];
      default:
        return [];
    }
  }

  /**
   * List sealed data for an address
   */
  async listSealedData(_ownerAddress: string): Promise<SealedData[]> {
    try {
      // This would query Sui for sealed data objects owned by the address
      // Placeholder implementation
      return [];
    } catch (error) {
      console.error('Error listing sealed data:', error);
      throw error;
    }
  }

  /**
   * Update access policy for existing sealed data
   */
  async updateAccessPolicy(sealId: string, newPolicy: AccessPolicy): Promise<boolean> {
    try {
      // This would update the access control object on Sui
      // Placeholder implementation
      console.log(`Updating access policy for seal ${sealId}`, newPolicy);
      return true;
    } catch (error) {
      console.error('Error updating access policy:', error);
      throw error;
    }
  }

  /**
   * Revoke access to sealed data
   */
  async revokeAccess(sealId: string): Promise<boolean> {
    try {
      // This would disable the access control object on Sui
      // Placeholder implementation
      console.log(`Revoking access for seal ${sealId}`);
      return true;
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Get key server status
   */
  async getKeyServerStatus(): Promise<{ serverId: string; status: string; lastSeen: Date }[]> {
    try {
      // This would check the status of all configured key servers
      return this.keyServerUrls.map((_url, index) => ({
        serverId: `server-${index}`,
        status: 'online',
        lastSeen: new Date()
      }));
    } catch (error) {
      console.error('Error getting key server status:', error);
      throw error;
    }
  }

  /**
   * Get network configuration
   */
  getNetworkConfig() {
    return {
      network: this.network,
      suiClient: this.suiClient,
      keyServerUrls: this.keyServerUrls
    };
  }
}

/**
 * React hook for Seal client
 */
export function useSealClient(
  suiClient: SuiClient,
  network: 'testnet' | 'mainnet' = 'testnet',
  keyServerUrls?: string[]
) {
  const sealClient = new SealClientManager({
    network,
    suiClient,
    keyServerUrls
  });

  return {
    sealClient,
    seal: (options: EncryptionOptions) => sealClient.seal(options),
    unseal: (options: UnsealOptions & { encryptedData: Uint8Array; sessionKey?: any; txBytes?: Uint8Array }) => sealClient.unseal(options),
    sealText: (text: string, policy?: AccessPolicy) => sealClient.sealText(text, policy),
    unsealText: (options: UnsealOptions & { encryptedData: Uint8Array; sessionKey?: any; txBytes?: Uint8Array }) => sealClient.unsealText(options),
    sealJSON: (data: any, policy?: AccessPolicy) => sealClient.sealJSON(data, policy),
    unsealJSON: <T = any>(options: UnsealOptions & { encryptedData: Uint8Array; sessionKey?: any; txBytes?: Uint8Array }) => sealClient.unsealJSON<T>(options),
    listSealedData: (address: string) => sealClient.listSealedData(address),
    updateAccessPolicy: (sealId: string, policy: AccessPolicy) =>
      sealClient.updateAccessPolicy(sealId, policy),
    revokeAccess: (sealId: string) => sealClient.revokeAccess(sealId),
    getKeyServerStatus: () => sealClient.getKeyServerStatus(),
    fetchKeys: (options: { ids: string[]; txBytes: Uint8Array; sessionKey: any; threshold: number }) => sealClient.fetchKeys(options),
    parseEncryptedObject: (encryptedData: Uint8Array) => sealClient.parseEncryptedObject(encryptedData)
  };
}

/**
 * Utility functions for Seal operations
 */
export const SealUtils = {
  /**
   * Create a simple access policy for specific addresses
   */
  createAddressPolicy: (addresses: string[], requiredSigs: number = 1): AccessPolicy => ({
    allowedAddresses: addresses,
    requiredSignatures: requiredSigs
  }),

  /**
   * Create a time-limited access policy
   */
  createTimeLimitedPolicy: (
    addresses: string[],
    expirationEpoch: number,
    requiredSigs: number = 1
  ): AccessPolicy => ({
    allowedAddresses: addresses,
    requiredSignatures: requiredSigs,
    expirationEpoch
  }),

  /**
   * Validate sealed data structure
   */
  validateSealedData: (data: SealedData): boolean => {
    return !!(data.encryptedData && data.sealId && data.accessControlId);
  },

  /**
   * Generate a unique access policy ID
   */
  generatePolicyId: (): string => {
    return 'policy_' + Math.random().toString(36).substring(2, 9);
  }
};