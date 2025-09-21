'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Transaction } from '@mysten/sui/transactions';
import { useKioskClient, ListedNFT } from '@/web3/kioskClient';
import { hasUserProfile } from "@/utils/userProfile";
import { WalrusClientManager } from '@/web3/walrusClient';


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
  const [searchFilter, setSearchFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-low' | 'price-high'>('newest');

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
          StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::nft::Sentence`
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const nfts: ListedNFT[] = ownedObjects.data
        .filter(obj => obj.data?.content?.dataType === 'moveObject')
        .map(obj => {
          const objectData = obj.data!;
          const content = objectData.content as any;
          return {
            id: objectData.objectId,
            content: {
              dataType: 'moveObject',
              fields: {
                id: objectData.objectId,
                text: content.fields?.text || '',
                letters_used: content.fields?.letters_used?.toString() || '0',
                walrus_cid: content.fields?.walrus_cid || '',
                created_epoch: content.fields?.created_epoch?.toString() || '0'
              }
            },
            digest: objectData.digest,
            version: objectData.version,
            isListed: false
          } as ListedNFT;
        });

      setMyNFTs(nfts);
    } catch (error) {
      console.error('Error loading my NFTs:', error);
    }
  };

  const loadMarketNFTs = async () => {
    setIsLoadingMarket(true);
    try {
      console.log('📊 Loading marketplace NFTs from blockchain...');

      // Check if marketplace is deployed before trying to load
      const packageId = process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID;
      const marketplaceId = process.env.NEXT_PUBLIC_MARKETPLACE_ID;

      if (!packageId || packageId.length < 10) {
        console.log('⚠️ Package ID not configured - marketplace not available');
        setMarketNFTs([]);
        return;
      }

      if (!marketplaceId || marketplaceId.length < 10) {
        console.log('⚠️ Marketplace ID not configured - checking for deployment...');
        // Try to get marketplace ID from events, but don't fail if not found
        try {
          const listedNFTs = await kioskClient.getListedSentenceNFTs();
          console.log(`📊 Found ${listedNFTs.length} listed NFTs`);
          setMarketNFTs(listedNFTs);
        } catch (deployError) {
          console.log('ℹ️ Marketplace not deployed yet - showing empty marketplace');
          setMarketNFTs([]);
        }
        return;
      }

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
      await kioskClient.createListing(selectedNFT.id, listPrice, tx);

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
            alert('Transaction failed. Please try again.');
          }
        }
      );

    } catch (error) {
      console.error('Error listing NFT:', error);

      // Show user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('not deployed')) {
          alert('🏪 Marketplace not deployed yet!\n\nTo enable NFT trading, please:\n1. Deploy the Move contracts: sui move publish --path suimming-move/\n2. Set NEXT_PUBLIC_MARKETPLACE_ID in your .env file');
        } else if (error.message.includes('Package ID not configured')) {
          alert('⚙️ Package ID not configured!\n\nPlease set NEXT_PUBLIC_SUIMMING_PACKAGE_ID in your .env file after deploying the Move contracts.');
        } else {
          alert(`Error: ${error.message}`);
        }
      } else {
        alert('An unexpected error occurred. Please try again.');
      }
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

  // Filter and sort marketplace NFTs
  const getFilteredAndSortedNFTs = (nfts: ListedNFT[]) => {
    let filteredNFTs = [...nfts];

    // Apply search filter
    if (searchFilter) {
      filteredNFTs = filteredNFTs.filter(nft =>
        nft.content.fields.text.toLowerCase().includes(searchFilter.toLowerCase()) ||
        nft.content.fields.letters_used?.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }

    // Apply price filter
    if (priceFilter !== 'all') {
      filteredNFTs = filteredNFTs.filter(nft => {
        const price = parseFloat(nft.price || '0');
        switch (priceFilter) {
          case 'low': return price < 1;
          case 'medium': return price >= 1 && price <= 10;
          case 'high': return price > 10;
          default: return true;
        }
      });
    }

    // Apply sorting
    filteredNFTs.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return parseFloat(a.price || '0') - parseFloat(b.price || '0');
        case 'price-high':
          return parseFloat(b.price || '0') - parseFloat(a.price || '0');
        case 'oldest':
          return a.content.fields.text.localeCompare(b.content.fields.text); // Fallback sort
        case 'newest':
        default:
          return b.content.fields.text.localeCompare(a.content.fields.text); // Fallback sort
      }
    });

    return filteredNFTs;
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
        {/* Enhanced Header */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/map"
                className="inline-flex items-center px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Map
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">🏪 Global NFT Marketplace</h1>
                <p className="text-gray-600 mt-1">Trade Sentence NFTs with collectors worldwide</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">
                  {marketNFTs.length + myNFTs.length}
                </div>
                <div className="text-sm text-gray-600">Total NFTs</div>
              </div>
              <button
                onClick={() => setActiveTab('my-collection')}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                List My NFTs
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-md">
              <div className="text-2xl font-bold text-blue-600">{marketNFTs.length}</div>
              <div className="text-sm text-gray-600">Available for Sale</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-md">
              <div className="text-2xl font-bold text-green-600">{myNFTs.length}</div>
              <div className="text-sm text-gray-600">Your Collection</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-md">
              <div className="text-2xl font-bold text-purple-600">
                {marketNFTs.reduce((sum, nft) => sum + (parseFloat(nft.price || '0')), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total Value (SUI)</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-md">
              <div className="text-2xl font-bold text-orange-600">
                {marketNFTs.length > 0 ? (marketNFTs.reduce((sum, nft) => sum + (parseFloat(nft.price || '0')), 0) / marketNFTs.length).toFixed(2) : '0.00'}
              </div>
              <div className="text-sm text-gray-600">Avg Price (SUI)</div>
            </div>
          </div>
        </div>

        {/* Enhanced Tabs with Filters */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('market')}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 ${
                    activeTab === 'market'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">🏪</span>
                    <span>Browse Market</span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {marketNFTs.length}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('my-collection')}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 ${
                    activeTab === 'my-collection'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">💎</span>
                    <span>My Collection</span>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      {myNFTs.length}
                    </span>
                  </div>
                </button>
              </nav>
            </div>

            {/* Filters and Search - Only show for market tab */}
            {activeTab === 'market' && (
              <div className="p-6 bg-gray-50">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Search */}
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by text content..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Price Filter */}
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Prices</option>
                    <option value="low">Under 1 SUI</option>
                    <option value="medium">1-10 SUI</option>
                    <option value="high">Over 10 SUI</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>

                  {/* Clear Filters */}
                  {(searchFilter || priceFilter !== 'all' || sortBy !== 'newest') && (
                    <button
                      onClick={() => {
                        setSearchFilter('');
                        setPriceFilter('all');
                        setSortBy('newest');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            )}
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
                {!process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID || process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID.length < 10 ? (
                  // Marketplace not deployed
                  <div className="max-w-lg mx-auto">
                    <h3 className="text-xl font-semibold text-gray-700 mb-3">Marketplace Not Deployed</h3>
                    <p className="text-gray-500 text-base mb-4">
                      The marketplace contracts haven't been deployed yet. To enable NFT trading, you need to deploy the Move contracts first.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <p className="text-yellow-800 text-sm mb-3">
                        🚀 <strong>Deploy Marketplace:</strong>
                      </p>
                      <ol className="text-yellow-700 text-sm text-left space-y-1">
                        <li>1. Navigate to: <code className="bg-yellow-100 px-1 rounded">cd suimming-move</code></li>
                        <li>2. Deploy: <code className="bg-yellow-100 px-1 rounded">sui move publish --gas-budget 100000000</code></li>
                        <li>3. Copy deployment IDs to <code className="bg-yellow-100 px-1 rounded">.env</code> file</li>
                        <li>4. Refresh this page</li>
                      </ol>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link
                        href="/map"
                        className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                      >
                        🗺️ Explore Game First
                      </Link>
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.open) {
                            window.open('https://github.com/MystenLabs/sui/blob/main/doc/src/build/install.md', '_blank');
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                      >
                        📘 Install Sui CLI
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 mt-4">
                      📖 See <code>DEPLOYMENT.md</code> for detailed instructions
                    </div>
                  </div>
                ) : (
                  // Marketplace deployed but empty
                  <div className="max-w-md mx-auto">
                    <h3 className="text-xl font-semibold text-gray-700 mb-3">No NFTs Available for Purchase</h3>
                    <p className="text-gray-500 text-base mb-4">
                      The marketplace is currently empty. Be the first to list your Sentence NFT for sale!
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-blue-700 text-sm">
                        💡 <strong>How to get started:</strong> Collect letters by visiting checkpoints on the map,
                        create Sentence NFTs in your studio, then list them in the marketplace for others to buy.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link
                        href="/map"
                        className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                      >
                        🗺️ Collect Letters
                      </Link>
                      <button
                        onClick={() => setActiveTab('my-collection')}
                        className="inline-flex items-center px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                      >
                        📋 List My NFTs
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (() => {
              const filteredNFTs = getFilteredAndSortedNFTs(marketNFTs);
              return filteredNFTs.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-400 text-6xl mb-6">🔍</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">No NFTs Found</h3>
                  <p className="text-gray-500 text-base mb-4">
                    Try adjusting your search filters or check back later for new listings.
                  </p>
                  <button
                    onClick={() => {
                      setSearchFilter('');
                      setPriceFilter('all');
                      setSortBy('newest');
                    }}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <>
                  {/* Results Info */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {filteredNFTs.length} of {marketNFTs.length} NFTs
                      {searchFilter && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          Search: &quot;{searchFilter}&quot;
                        </span>
                      )}
                    </div>
                    <button
                      onClick={loadMarketNFTs}
                      disabled={isLoadingMarket}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>

                  {/* NFT Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredNFTs.map((nft) => {
                      // Check if the current user owns this NFT by comparing with seller address
                      const isCurrentUserOwner = nft.seller === currentAccount?.address;

                      return (
                        <NFTCard
                          key={nft.id}
                          nft={nft}
                          isOwner={isCurrentUserOwner}
                          onPurchase={!isCurrentUserOwner ? () => handlePurchaseNFT(nft) : undefined}
                          isProcessing={isProcessing}
                        />
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">My Sentence NFTs</h2>
            {myNFTs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">💎</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">No NFTs in Your Collection</h3>
                <p className="text-gray-500 text-base mb-6">
                  Start by collecting letters from checkpoints and creating Sentence NFTs in your studio.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/map"
                    className="inline-flex items-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    🗺️ Collect Letters
                  </Link>
                  <Link
                    href="/my"
                    className="inline-flex items-center px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    ✍️ Create NFTs
                  </Link>
                </div>
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
                &quot;{selectedNFT.content.fields.text}&quot;
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const suiClient = useSuiClient();

  // Load Walrus image
  const loadWalrusImage = async (walrusCid: string): Promise<string | null> => {
    try {
      const walrusClient = new WalrusClientManager({
        network: 'testnet',
        suiClient: suiClient
      });

      const fileBytes = await walrusClient.downloadFile(walrusCid);
      const imageData = new Uint8Array(fileBytes);
      const blob = new Blob([imageData], { type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    } catch (error) {
      console.error('Failed to load Walrus image:', error);
      return null;
    }
  };

  useEffect(() => {
    if (nft.content.fields.walrus_cid) {
      setImageLoading(true);
      setImageError(false);

      loadWalrusImage(nft.content.fields.walrus_cid)
        .then(blobUrl => {
          if (blobUrl) {
            setImageUrl(blobUrl);
            setImageLoading(false);
            setImageError(false);
          } else {
            setImageLoading(false);
            setImageError(true);
          }
        })
        .catch(() => {
          setImageLoading(false);
          setImageError(true);
        });
    }

    // Cleanup blob URL on unmount
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [nft.content.fields.walrus_cid]);

  const generateFallbackImage = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 400;
    canvas.height = 300;

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#e0e7ff');
    gradient.addColorStop(0.5, '#c7d2fe');
    gradient.addColorStop(1, '#a5b4fc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Title
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Suimming NFT', canvas.width / 2, 60);

    // Main text with word wrapping
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 20px Arial';
    const words = nft.content.fields.text.split(' ');
    let line = '';
    let y = 140;
    const maxWidth = canvas.width - 40;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && i > 0) {
        ctx.fillText(`"${line.trim()}"`, canvas.width / 2, y);
        line = words[i] + ' ';
        y += 30;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(`"${line.trim()}"`, canvas.width / 2, y);
    }

    return canvas.toDataURL('image/png');
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100 overflow-hidden">
      {/* NFT Image */}
      <div className="relative h-56 bg-gray-100 overflow-hidden">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent"></div>
          </div>
        )}
        {imageError ? (
          <img
            src={generateFallbackImage()}
            alt={`NFT Fallback: ${nft.content.fields.text}`}
            className="w-full h-full object-cover"
          />
        ) : (
          imageUrl && (
            <img
              src={imageUrl}
              alt={`NFT: ${nft.content.fields.text}`}
              className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
            />
          )
        )}

        {/* Price Badge */}
        {nft.isListed && nft.price && (
          <div className="absolute top-4 right-4">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              {nft.price} SUI
            </div>
          </div>
        )}
      </div>

      {/* NFT Details */}
      <div className="p-5">
        <div className="mb-3">
          <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-2">
            &quot;{nft.content.fields.text}&quot;
          </h3>
          <p className="text-sm text-gray-500">
            Letters Used: {nft.content.fields.letters_used || 'N/A'}
          </p>
        </div>

        <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
          <span>ID: {nft.id.slice(0, 8)}...</span>
          <span>Created: Epoch {nft.content.fields.created_epoch}</span>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isOwner ? (
            <>
              {nft.isListed ? (
                <div className="flex gap-2">
                  <button
                    disabled
                    className="flex-1 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg font-medium flex items-center justify-center gap-2 border border-blue-200"
                  >
                    <span className="text-lg">👤</span>
                    Your Listing
                  </button>
                  <button
                    onClick={() => {}}
                    className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-medium transition-colors"
                    title="Cancel listing"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={onList}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="text-lg">📝</span>
                  List for Sale
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onPurchase}
              disabled={isProcessing || !onPurchase}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <span className="text-lg">💰</span>
                  Buy Now for {nft.price} SUI
                </>
              )}
            </button>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (imageUrl) {
                  window.open(imageUrl, '_blank');
                }
              }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(nft.id);
              }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy ID
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}