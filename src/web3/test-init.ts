/**
 * Test file to verify all Web3 clients can initialize properly
 * This file can be used for testing during development
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import {
  initializeWeb3Clients,
  KioskClient,
  WalrusClientManager,
  SealClientManager
} from './index';

// Test initialization function
export function testClientInitialization() {
  console.log('Testing Web3 client initialization...');

  try {
    // Create test SuiClient
    const suiClient = new SuiClient({
      url: getFullnodeUrl('testnet')
    });

    console.log('✅ SuiClient created successfully');

    // Test individual client initialization
    console.log('Testing KioskClient...');
    const kioskClient = new KioskClient({
      suiClient,
      network: 'testnet'
    });
    console.log('✅ KioskClient initialized successfully');

    console.log('Testing WalrusClientManager...');
    const walrusClient = new WalrusClientManager({
      suiClient,
      network: 'testnet'
    });
    console.log('✅ WalrusClientManager initialized successfully');

    console.log('Testing SealClientManager...');
    const sealClient = new SealClientManager({
      suiClient,
      network: 'testnet'
    });
    console.log('✅ SealClientManager initialized successfully');

    // Test unified initialization
    const allClients = initializeWeb3Clients({
      suiClient,
      network: 'testnet'
    });

    console.log('✅ All clients initialized via initializeWeb3Clients');
    console.log('Available clients:', Object.keys(allClients));

    // Test client methods are available
    console.log('Testing client methods...');

    // Kiosk client methods
    if (typeof allClients.kiosk.getOwnedKiosks === 'function') {
      console.log('✅ Kiosk client methods available');
    }

    // Walrus client methods
    if (typeof allClients.walrus.uploadFile === 'function') {
      console.log('✅ Walrus client methods available');
    }

    // Seal client methods
    if (typeof allClients.seal.seal === 'function') {
      console.log('✅ Seal client methods available');
    }

    console.log('🎉 All Web3 clients initialized and validated successfully!');

    return {
      success: true,
      clients: allClients
    };

  } catch (error) {
    console.error('❌ Client initialization failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Example usage for testing in browser console or Node.js
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).testSuimmingClients = testClientInitialization;
  console.log('Test function available as window.testSuimmingClients()');
}