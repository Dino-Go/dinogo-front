'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Transaction } from '@mysten/sui/transactions';
import { useKioskClient, ListedNFT } from '@/web3/kioskClient';
import { hasUserProfile } from "@/utils/userProfile";

interface SentenceNFT {
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
  digest: string;
  version: string;
}

export default function MarketPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [myNFTs, setMyNFTs] = useState<ListedNFT[]>([]);
  const [marketNFTs, setMarketNFTs] = useState<ListedNFT[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'my-collection'>('market');
  const [selectedNFT, setSelectedNFT] = useState<ListedNFT | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const kioskClient = useKioskClient(suiClient);

  useEffect(() => {
    const init = async () => {
      if (!currentAccount) {
        router.push('/');
        return;
      }

      try {
        const profileExists = await hasUserProfile(suiClient, currentAccount.address);
        if (!profileExists) {
          router.push('/signup');
          return;
        }

        setHasProfile(true);
        await Promise.all([
          loadMyNFTs(),
          loadMarketNFTs()
        ]);
      } catch (error) {
        console.error('Error initializing market:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [currentAccount, router, suiClient]);

  const loadMyNFTs = async () => {
    if (!currentAccount) return;

    try {
      const ownedObjects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::nft::SentenceNFT`
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const nfts: ListedNFT[] = ownedObjects.data
        .filter(obj => obj.data?.content?.dataType === 'moveObject')
        .map(obj => ({
          ...(obj.data as SentenceNFT),
          isListed: false
        }));

      setMyNFTs(nfts);
    } catch (error) {
      console.error('Error loading my NFTs:', error);
    }
  };

  const loadMarketNFTs = async () => {
    setIsLoadingMarket(true);
    try {
      console.log('📊 Loading marketplace NFTs from blockchain...');

      // Get all listed NFTs from kiosks and marketplace contracts
      const listedNFTs = await kioskClient.getListedSentenceNFTs();

      console.log(`📊 Found ${listedNFTs.length} listed NFTs`);
      setMarketNFTs(listedNFTs);
    } catch (error) {
      console.error('Error loading market NFTs:', error);
      // Don't throw error, just set empty array and log the issue
      setMarketNFTs([]);
    } finally {
      setIsLoadingMarket(false);
    }
  };

  const handleListNFT = async () => {
    if (!selectedNFT || !listPrice || !currentAccount) return;

    setIsProcessing(true);
    try {
      const tx = new Transaction();

      // Create marketplace listing
      kioskClient.createListing(selectedNFT.id, listPrice, tx);

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async () => {
            console.log(`Successfully listed NFT ${selectedNFT.id} for ${listPrice} SUI`);
            setShowListModal(false);
            setListPrice('');
            setSelectedNFT(null);
            await Promise.all([loadMyNFTs(), loadMarketNFTs()]);
          },
          onError: (error) => {
            console.error('Error listing NFT:', error);
          }
        }
      );

    } catch (error) {
      console.error('Error listing NFT:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchaseNFT = async (nft: ListedNFT) => {
    if (!currentAccount || !nft.price || !nft.listingId) return;

    setIsProcessing(true);
    try {
      const tx = new Transaction();

      // Purchase from marketplace
      kioskClient.purchaseListing(nft.listingId, nft.price, tx);

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async () => {
            console.log(`Successfully purchased NFT ${nft.id} for ${nft.price} SUI`);
            await Promise.all([loadMyNFTs(), loadMarketNFTs()]);
          },
          onError: (error) => {
            console.error('Error purchasing NFT:', error);
          }
        }
      );

    } catch (error) {
      console.error('Error purchasing NFT:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const openListModal = (nft: ListedNFT) => {
    setSelectedNFT(nft);
    setShowListModal(true);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading marketplace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/map"
              className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              ← Back to Map
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">NFT Marketplace</h1>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/my"
              className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
            >
              ✍️ Create NFT
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('market')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'market'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🏪 Browse Market ({marketNFTs.length})
              </button>
              <button
                onClick={() => setActiveTab('my-collection')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'my-collection'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                💎 My Collection ({myNFTs.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'market' ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Available Sentence NFTs</h2>
              {isLoadingMarket && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-sm">Loading marketplace...</span>
                </div>
              )}
            </div>
            {isLoadingMarket ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-500">Scanning blockchain for listed NFTs...</p>
              </div>
            ) : marketNFTs.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-gray-400 text-6xl mb-6">🏪</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">No NFTs Available for Purchase</h3>
                <div className="max-w-md mx-auto">
                  <p className="text-gray-500 text-base mb-4">
                    The marketplace is currently empty. Be the first to list your Sentence NFT for sale!
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-700 text-sm">
                      💡 <strong>How to get started:</strong> Create letters by visiting checkpoints on the map,
                      compose sentences with your letters, mint them as NFTs, then list them here for others to buy.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                      href="/map"
                      className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                    >
                      🗺️ Explore Map
                    </Link>
                    <Link
                      href="/my"
                      className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                    >
                      ✍️ Create NFT
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {marketNFTs.map((nft) => (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    isOwner={false}
                    onPurchase={() => handlePurchaseNFT(nft)}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">My Sentence NFTs</h2>
            {myNFTs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">💎</div>
                <p className="text-gray-500 text-lg">You don't own any Sentence NFTs yet</p>
                <Link
                  href="/my"
                  className="inline-flex items-center px-6 py-3 mt-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  ✍️ Create Your First NFT
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {myNFTs.map((nft) => (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    isOwner={true}
                    onList={() => openListModal(nft)}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* List NFT Modal */}
      {showListModal && selectedNFT && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">List NFT for Sale</h3>

            <div className="mb-4">
              <p className="text-gray-600 mb-2">NFT Text:</p>
              <div className="bg-gray-100 p-3 rounded border font-mono text-sm">
                "{selectedNFT.content.fields.text}"
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (SUI)
              </label>
              <input
                type="number"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0.1"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowListModal(false);
                  setListPrice('');
                  setSelectedNFT(null);
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleListNFT}
                disabled={!listPrice || isProcessing}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Listing...
                  </>
                ) : (
                  'List for Sale'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface NFTCardProps {
  nft: ListedNFT;
  isOwner: boolean;
  onPurchase?: () => void;
  onList?: () => void;
  isProcessing: boolean;
}

function NFTCard({ nft, isOwner, onPurchase, onList, isProcessing }: NFTCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      {/* NFT Preview */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800 mb-2 font-mono">
            "{nft.content.fields.text}"
          </div>
          <div className="text-xs text-gray-500">
            Used: {nft.content.fields.consume}
          </div>
        </div>
      </div>

      {/* NFT Details */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">
            ID: {nft.id.slice(0, 8)}...
          </div>
          {nft.isListed && nft.price && (
            <div className="text-lg font-bold text-green-600">
              {nft.price} SUI
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Owner: {nft.content.fields.owner.slice(0, 6)}...{nft.content.fields.owner.slice(-4)}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isOwner ? (
            <>
              {nft.isListed ? (
                <button
                  disabled
                  className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded font-medium"
                >
                  🏪 Listed for Sale
                </button>
              ) : (
                <button
                  onClick={onList}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  📝 List for Sale
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onPurchase}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  💰 Buy Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}