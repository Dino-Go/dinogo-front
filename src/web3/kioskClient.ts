'use client';

import { SuiClient } from '@mysten/sui/client';

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
   * Get listings from marketplace contract
   */
  private async getMarketplaceListings(): Promise<ListedNFT[]> {
    try {
      console.log('🏪 Fetching marketplace listings...');

      // Get marketplace ID first
      const marketplaceId = await this.getMarketplaceId();

      // Get the marketplace object directly
      const marketplaceObject = await this.suiClient.getObject({
        id: marketplaceId,
        options: {
          showContent: true,
          showType: true
        }
      });

      const listings: ListedNFT[] = [];

      if (marketplaceObject.data?.content?.dataType === 'moveObject') {
        // Get marketplace events to find listings
        try {
          const events = await this.suiClient.queryEvents({
            query: {
              MoveEventType: `${this.packageId}::marketplace::NFTListed`
            },
            order: 'descending',
            limit: 50 // Adjust as needed
          });

          for (const event of events.data) {
            const eventData = event.parsedJson as any;

            // Check if this NFT is still listed (not purchased or delisted)
            const stillListed = await this.isNFTStillListed(eventData.nft_id);

            if (stillListed) {
              // Get the actual NFT object
              const nftObject = await this.suiClient.getObject({
                id: eventData.nft_id,
                options: {
                  showContent: true,
                  showType: true
                }
              });

              if (nftObject.data?.content?.dataType === 'moveObject') {
                const nftContent = nftObject.data.content as any;

                listings.push({
                  id: eventData.nft_id,
                  content: {
                    dataType: 'moveObject',
                    fields: {
                      id: eventData.nft_id,
                      text: nftContent.fields?.text || eventData.text || '',
                      letters_used: nftContent.fields?.letters_used?.toString() || '0',
                      walrus_cid: nftContent.fields?.walrus_cid || eventData.walrus_cid || '',
                      created_epoch: nftContent.fields?.created_epoch?.toString() || '0'
                    }
                  },
                  price: this.formatSuiAmount(eventData.price),
                  isListed: true,
                  listingId: eventData.nft_id,
                  seller: eventData.seller
                });
              }
            }
          }
        } catch (eventError) {
          console.warn('Error fetching marketplace events:', eventError);
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
   * Check if an NFT is still listed in marketplace
   */
  private async isNFTStillListed(nftId: string): Promise<boolean> {
    try {
      // This would check if the NFT exists in marketplace storage
      // For now, we'll assume it's listed if we can query it
      // In production, you'd query the marketplace's listings table
      return true;
    } catch (error) {
      return false;
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
      console.log(`Creating listing for NFT ${nftId} at price ${price} SUI`);

      // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      const priceInMist = Math.floor(parseFloat(price) * 1_000_000_000);

      // Get the marketplace object ID (this would be stored/cached)
      const marketplaceId = await this.getMarketplaceId();

      transaction.moveCall({
        target: `${this.packageId}::marketplace::list_nft`,
        arguments: [
          transaction.object(marketplaceId),
          transaction.object(nftId),
          transaction.pure.u64(priceInMist)
        ],
      });

      return transaction;
    } catch (error) {
      console.error('Error creating listing:', error);

      if (error instanceof Error) {
        if (error.message.includes('not deployed')) {
          throw new Error('🏪 Marketplace not deployed yet!\n\nTo enable NFT trading, please:\n1. Deploy the Move contracts: sui move publish --path suimming-move/\n2. Set NEXT_PUBLIC_MARKETPLACE_ID in your .env file');
        }
        if (error.message.includes('Package ID not configured')) {
          throw new Error('⚙️ Package ID not configured!\n\nPlease set NEXT_PUBLIC_SUIMMING_PACKAGE_ID in your .env file after deploying the Move contracts.');
        }
      }

      throw error;
    }
  }

  /**
   * Purchase a listed NFT
   */
  async purchaseListing(listingId: string, price: string, transaction: any) {
    try {
      console.log(`Purchasing listing ${listingId} for ${price} SUI`);

      // Convert SUI to MIST
      const priceInMist = Math.floor(parseFloat(price) * 1_000_000_000);

      // Get the marketplace object ID
      const marketplaceId = await this.getMarketplaceId();

      // Split coins for payment
      const [paymentCoin] = transaction.splitCoins(transaction.gas, [priceInMist]);

      transaction.moveCall({
        target: `${this.packageId}::marketplace::purchase_nft`,
        arguments: [
          transaction.object(marketplaceId),
          transaction.object(listingId), // The NFT object
          paymentCoin,
          transaction.pure.address(listingId) // NFT ID for lookup
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

      const marketplaceId = await this.getMarketplaceId();

      transaction.moveCall({
        target: `${this.packageId}::marketplace::delist_nft`,
        arguments: [
          transaction.object(marketplaceId),
          transaction.object(listingId), // The NFT object
          transaction.pure.address(listingId) // NFT ID for lookup
        ],
      });

      return transaction;
    } catch (error) {
      console.error('Error canceling listing:', error);
      throw error;
    }
  }

  /**
   * Get the marketplace object ID
   */
  private async getMarketplaceId(): Promise<string> {
    try {
      // First try to get from environment variable (set during deployment)
      const marketplaceId = process.env.NEXT_PUBLIC_MARKETPLACE_ID;
      if (marketplaceId && marketplaceId.length > 10 && marketplaceId.startsWith('0x')) {
        // Validate it's a proper address format
        if (marketplaceId.length >= 42) {
          return marketplaceId;
        }
      }

      // Check if package ID is available
      if (!this.packageId || this.packageId.length < 10) {
        throw new Error('Package ID not configured - please deploy Move contracts first');
      }

      // Fallback: Query for marketplace creation events to find the marketplace ID
      console.log('🔍 Looking for marketplace deployment events...');
      const events = await this.suiClient.queryEvents({
        query: {
          MoveEventType: `${this.packageId}::marketplace::MarketplaceCreated`
        },
        order: 'ascending',
        limit: 1
      });

      if (events.data.length > 0) {
        const eventData = events.data[0].parsedJson as any;
        console.log('✅ Found marketplace from events:', eventData.marketplace_id);
        return eventData.marketplace_id;
      }

      throw new Error('Marketplace not deployed yet');
    } catch (error) {
      console.error('Error getting marketplace ID:', error);

      if (error instanceof Error && error.message.includes('not deployed')) {
        throw new Error('🏪 Marketplace not deployed yet. Please deploy the Move contracts first using: sui move publish --path suimming-move/');
      }

      throw new Error('Marketplace not available - please deploy contracts or set NEXT_PUBLIC_MARKETPLACE_ID');
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
      letters_used: string;
      walrus_cid: string;
      created_epoch: string;
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