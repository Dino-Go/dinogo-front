/**
 * Web3 Clients for Suimming Frontend
 *
 * This module provides initialized clients for interacting with:
 * - Kiosk: NFT marketplace and trading
 * - Walrus: Decentralized file storage
 * - Seal: Decentralized secrets management
 */

import { SuiClient } from '@mysten/sui/client';

// Import classes for use in functions
import { KioskClient } from './kioskClient';
import { WalrusClientManager } from './walrusClient';
import { SealClientManager } from './sealClient';

// Core clients - re-export everything
export {
  KioskClient,
  useKioskClient,
  type KioskClientConfig,
  type KioskTransaction,
  type OwnedKiosks
} from './kioskClient';

export {
  WalrusClientManager,
  useWalrusClient,
  WalrusUtils,
  type WalrusClientConfig,
  type UploadOptions,
  type UploadResult,
  type FileInfo
} from './walrusClient';

export {
  SealClientManager,
  useSealClient,
  SealUtils,
  type SealClientConfig,
  type EncryptionOptions,
  type AccessPolicy,
  type SealedData,
  type KeyShare,
  type UnsealOptions
} from './sealClient';

// Configuration types
export interface Web3ClientsConfig {
  suiClient: SuiClient;
  network: 'testnet' | 'mainnet';
  keyServerUrls?: string[];
}

// Initialize all clients
export function initializeWeb3Clients(config: Web3ClientsConfig) {
  const { suiClient, network, keyServerUrls } = config;

  return {
    kiosk: new KioskClient({ suiClient, network }),
    walrus: new WalrusClientManager({ suiClient, network }),
    seal: new SealClientManager({ suiClient, network, keyServerUrls })
  };
}

// React hook for all clients
export function useWeb3Clients(config: Web3ClientsConfig) {
  return initializeWeb3Clients(config);
}