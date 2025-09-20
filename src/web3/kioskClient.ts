'use client';

import { SuiClient } from '@mysten/sui.js/client';

// Note: Install @mysten/kiosk dependency when permission issue is resolved
// For now, we'll prepare the structure and types

// Types for Kiosk functionality
export interface KioskClientConfig {
  suiClient: SuiClient;
  network?: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
}

export interface KioskTransaction {
  create(): void;
  getKiosk(): any;
  getKioskCap(): any;
  shareAndTransferCap(address: string): void;
  borrowTx(itemId: string): any;
  finalize(): void;
}

export interface OwnedKiosks {
  kioskOwnerCaps: any[];
  kioskIds: string[];
}

/**
 * Kiosk Client for managing NFT kiosks on Sui
 *
 * Key Features:
 * - Create and manage kiosks for NFT trading
 * - Handle kiosk ownership and transfers
 * - Facilitate borrowing and listing of items
 *
 * Usage:
 * ```tsx
 * const kioskClient = new KioskClient({ suiClient });
 * const { kioskOwnerCaps } = await kioskClient.getOwnedKiosks(userAddress);
 * ```
 */
export class KioskClient {
  private suiClient: SuiClient;
  private network: string;
  private packageId: string;

  constructor(config: KioskClientConfig) {
    this.suiClient = config.suiClient;
    this.network = config.network || 'testnet';
    this.packageId = process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID || '';
    console.log(`Initializing Kiosk client for ${this.network} network`);
  }

  /**
   * Get all kiosks owned by an address
   */
  async getOwnedKiosks(_ownerAddress: string): Promise<OwnedKiosks> {
    try {
      // TODO: Implement when @mysten/kiosk is available
      // const kioskIds = await this.kioskClient.getOwnedKiosks({ address: ownerAddress });

      // Placeholder implementation
      return {
        kioskOwnerCaps: [],
        kioskIds: []
      };
    } catch (error) {
      console.error('Error fetching owned kiosks:', error);
      throw error;
    }
  }

  /**
   * Create a new kiosk transaction
   */
  createKioskTransaction(_transaction: any): KioskTransaction {
    // TODO: Implement when @mysten/kiosk is available
    // return new KioskTransaction({ kioskClient: this, transaction });

    // Placeholder implementation
    return {
      create: () => console.log('Creating kiosk...'),
      getKiosk: () => null,
      getKioskCap: () => null,
      shareAndTransferCap: (address: string) => console.log(`Transferring cap to ${address}`),
      borrowTx: (itemId: string) => console.log(`Borrowing item ${itemId}`),
      finalize: () => console.log('Finalizing kiosk transaction')
    };
  }

  /**
   * Get kiosk object by ID
   */
  async getKiosk(kioskId: string) {
    try {
      const kioskObject = await this.suiClient.getObject({
        id: kioskId,
        options: {
          showContent: true,
          showOwner: true
        }
      });
      return kioskObject;
    } catch (error) {
      console.error('Error fetching kiosk:', error);
      throw error;
    }
  }

  /**
   * List an item in a kiosk
   */
  async listItem(kioskId: string, itemId: string, price: string) {
    // TODO: Implement listing logic
    console.log(`Listing item ${itemId} in kiosk ${kioskId} for ${price}`);
  }

  /**
   * Delist an item from a kiosk
   */
  async delistItem(kioskId: string, itemId: string) {
    // TODO: Implement delisting logic
    console.log(`Delisting item ${itemId} from kiosk ${kioskId}`);
  }

  /**
   * Purchase an item from a kiosk
   */
  async purchaseItem(kioskId: string, itemId: string, price: string) {
    // TODO: Implement purchase logic
    console.log(`Purchasing item ${itemId} from kiosk ${kioskId} for ${price}`);
  }

  /**
   * Get all listed Sentence NFTs across all kiosks and marketplace contracts
   */
  async getListedSentenceNFTs(): Promise<ListedNFT[]> {
    try {
      console.log('🔍 Scanning blockchain for listed Sentence NFTs...');

      // Method 1: Query marketplace objects directly (if marketplace contract exists)
      const marketplaceListings = await this.getMarketplaceListings();

      // Method 2: Scan all kiosks for listed Sentence NFTs
      const kioskListings = await this.getKioskListings();

      // Combine and deduplicate results
      const allListings = [...marketplaceListings, ...kioskListings];
      const uniqueListings = allListings.filter((listing, index, self) =>
        index === self.findIndex(l => l.id === listing.id)
      );

      console.log(`📊 Found ${uniqueListings.length} total listings`);
      return uniqueListings;
    } catch (error) {
      console.error('Error fetching listed NFTs:', error);
      return [];
    }
  }

  /**
   * Get listings from marketplace contract (if it exists)
   */
  private async getMarketplaceListings(): Promise<ListedNFT[]> {
    try {
      // Query for marketplace listing objects
      const marketplaceObjects = await this.suiClient.queryObjects({
        query: {
          StructType: `${this.packageId}::marketplace::Listing`
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const listings: ListedNFT[] = [];

      for (const obj of marketplaceObjects.data) {
        if (obj.data?.content?.dataType === 'moveObject') {
          const content = obj.data.content as any;
          const listingFields = content.fields;

          // Get the actual NFT object
          try {
            const nftObject = await this.suiClient.getObject({
              id: listingFields.nft_id,
              options: {
                showContent: true,
                showType: true
              }
            });

            if (nftObject.data?.content?.dataType === 'moveObject') {
              const nftContent = nftObject.data.content as any;

              // Verify it's a Sentence NFT
              if (nftContent.type?.includes('::nft::Sentence')) {
                listings.push({
                  id: listingFields.nft_id,
                  content: {
                    dataType: 'moveObject',
                    fields: {
                      id: listingFields.nft_id,
                      text: nftContent.fields.text || '',
                      consume: nftContent.fields.consume || '',
                      walrus_cid: nftContent.fields.walrus_cid || '',
                      owner: listingFields.seller || ''
                    }
                  },
                  price: this.formatSuiAmount(listingFields.price),
                  isListed: true,
                  listingId: obj.data.objectId,
                  seller: listingFields.seller
                });
              }
            }
          } catch (nftError) {
            console.warn(`Could not fetch NFT ${listingFields.nft_id}:`, nftError);
          }
        }
      }

      console.log(`📋 Found ${listings.length} marketplace listings`);
      return listings;
    } catch (error) {
      console.log('No marketplace contract found or error querying:', error);
      return [];
    }
  }

  /**
   * Get listings from kiosks
   */
  private async getKioskListings(): Promise<ListedNFT[]> {
    try {
      // This would require scanning all kiosk objects
      // For now, return empty array as kiosk scanning is complex
      console.log('🏪 Kiosk scanning not yet implemented');
      return [];
    } catch (error) {
      console.error('Error scanning kiosks:', error);
      return [];
    }
  }

  /**
   * Format SUI amount from MIST (smallest unit) to SUI
   */
  private formatSuiAmount(mistAmount: string | number): string {
    const mist = typeof mistAmount === 'string' ? parseInt(mistAmount) : mistAmount;
    return (mist / 1_000_000_000).toString(); // Convert MIST to SUI
  }

  /**
   * Create a marketplace listing for a Sentence NFT
   */
  async createListing(nftId: string, price: string, transaction: any) {
    try {
      // This would typically involve:
      // 1. Creating a kiosk if user doesn't have one
      // 2. Placing the NFT in the kiosk
      // 3. Setting the price
      // 4. Making it available for purchase

      console.log(`Creating listing for NFT ${nftId} at price ${price} SUI`);

      // Placeholder transaction for demonstration
      transaction.moveCall({
        target: `${this.packageId}::marketplace::list_nft`,
        arguments: [
          transaction.object(nftId),
          transaction.pure(price)
        ],
      });

      return transaction;
    } catch (error) {
      console.error('Error creating listing:', error);
      throw error;
    }
  }

  /**
   * Purchase a listed NFT
   */
  async purchaseListing(listingId: string, price: string, transaction: any) {
    try {
      console.log(`Purchasing listing ${listingId} for ${price} SUI`);

      // Placeholder transaction for demonstration
      transaction.moveCall({
        target: `${this.packageId}::marketplace::purchase_nft`,
        arguments: [
          transaction.object(listingId),
          transaction.pure(price)
        ],
      });

      return transaction;
    } catch (error) {
      console.error('Error purchasing listing:', error);
      throw error;
    }
  }

  /**
   * Cancel a listing
   */
  async cancelListing(listingId: string, transaction: any) {
    try {
      console.log(`Canceling listing ${listingId}`);

      transaction.moveCall({
        target: `${this.packageId}::marketplace::cancel_listing`,
        arguments: [
          transaction.object(listingId)
        ],
      });

      return transaction;
    } catch (error) {
      console.error('Error canceling listing:', error);
      throw error;
    }
  }
}

// Additional types for marketplace functionality
export interface ListedNFT {
  id: string;
  content: {
    dataType: string;
    fields: {
      id: string;
      text: string;
      consume: string;
      walrus_cid: string;
      owner: string;
    };
  };
  price?: string;
  isListed: boolean;
  listingId?: string;
  seller?: string;
}

/**
 * Hook for using Kiosk client in React components
 */
export function useKioskClient(suiClient: SuiClient) {
  const kioskClient = new KioskClient({ suiClient });

  return {
    kioskClient,
    getOwnedKiosks: (address: string) => kioskClient.getOwnedKiosks(address),
    createKioskTransaction: (tx: any) => kioskClient.createKioskTransaction(tx),
    getKiosk: (kioskId: string) => kioskClient.getKiosk(kioskId),
    listItem: (kioskId: string, itemId: string, price: string) =>
      kioskClient.listItem(kioskId, itemId, price),
    delistItem: (kioskId: string, itemId: string) =>
      kioskClient.delistItem(kioskId, itemId),
    purchaseItem: (kioskId: string, itemId: string, price: string) =>
      kioskClient.purchaseItem(kioskId, itemId, price),
    // Marketplace functions
    getListedSentenceNFTs: () => kioskClient.getListedSentenceNFTs(),
    createListing: (nftId: string, price: string, transaction: any) =>
      kioskClient.createListing(nftId, price, transaction),
    purchaseListing: (listingId: string, price: string, transaction: any) =>
      kioskClient.purchaseListing(listingId, price, transaction),
    cancelListing: (listingId: string, transaction: any) =>
      kioskClient.cancelListing(listingId, transaction)
  };
}