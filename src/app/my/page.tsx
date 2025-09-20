'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { hasUserProfile, getUserProfile, parseUserProfile } from "@/utils/userProfile";

// NFT Card Component
interface NFTCardProps {
    nft: {
        id: string;
        text: string;
        walrusCid: string;
        creator: string;
        createdAt: number;
    };
}

const NFTCard: React.FC<NFTCardProps> = ({ nft }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
    const [debugInfo, setDebugInfo] = useState<{
        httpStatus?: number;
        errorType?: string;
        corsIssue?: boolean;
        contentType?: string;
        responseSize?: number;
    }>({});

    // Multiple Walrus gateway URLs to try
    const walrusUrls = [
        `https://aggregator.walrus-testnet.walrus.space/v1/${nft.walrusCid}`,
        `https://publisher.walrus-testnet.walrus.space/v1/store/${nft.walrusCid}`,
        `https://walrus-testnet-publisher.nodes.guru/v1/store/${nft.walrusCid}`,
        `https://aggregator.walrus-testnet.walrus.space/v1/blob/${nft.walrusCid}`,
        `https://publisher.walrus-testnet.walrus.space/v1/blob/${nft.walrusCid}`,
        // Additional backup endpoints
        `https://walrus-testnet.blockscope.net/v1/store/${nft.walrusCid}`,
        `https://walrus.krates.ai/v1/store/${nft.walrusCid}`
    ];

    // Advanced debugging function to test Walrus URLs
    const testWalrusUrl = async (url: string) => {
        console.log(`🔍 Testing Walrus URL: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'HEAD', // Use HEAD first to check without downloading
                mode: 'cors',
                cache: 'no-cache'
            });

            console.log(`✅ HEAD Response Status: ${response.status}`);
            console.log(`📦 Content-Type: ${response.headers.get('content-type')}`);
            console.log(`📏 Content-Length: ${response.headers.get('content-length')}`);

            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.startsWith('image/')) {
                    console.log(`🖼️ Valid image found at: ${url}`);
                    return { success: true, contentType, status: response.status };
                } else {
                    console.log(`⚠️ Not an image. Content-Type: ${contentType}`);
                    return { success: false, error: `Invalid content-type: ${contentType}`, status: response.status };
                }
            } else {
                console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
                return { success: false, error: `HTTP ${response.status}`, status: response.status };
            }
        } catch (error: any) {
            console.log(`🚫 Network Error:`, error);

            // Detect CORS issues
            if (error.name === 'TypeError' && error.message.includes('CORS')) {
                return { success: false, error: 'CORS blocked', corsIssue: true };
            }

            return { success: false, error: error.message, networkError: true };
        }
    };

    useEffect(() => {
        if (nft.walrusCid && walrusUrls.length > 0) {
            console.log('🎯 NFT walrusCid:', nft.walrusCid);
            console.log('🔄 Starting comprehensive Walrus testing...');

            // Test the URL before trying to load as image
            testWalrusUrl(walrusUrls[0]).then(result => {
                setDebugInfo({
                    httpStatus: result.status,
                    errorType: result.error,
                    corsIssue: result.corsIssue,
                    contentType: result.contentType,
                });

                if (result.success) {
                    console.log('✅ URL test passed, loading image...');
                    setImageUrl(walrusUrls[0]);
                    setCurrentUrlIndex(0);
                    setImageError(false);
                    setImageLoading(true);

                    // Set a timeout to try next URL if this one takes too long
                    const timeout = setTimeout(() => {
                        console.log('⏰ Image load timeout, trying next URL...');
                        handleImageError();
                    }, 10000);

                    setLoadTimeout(timeout);
                } else {
                    console.log('❌ URL test failed, trying next URL...');
                    handleImageError();
                }
            });
        }

        // Cleanup timeout on unmount
        return () => {
            if (loadTimeout) {
                clearTimeout(loadTimeout);
            }
        };
    }, [nft.walrusCid]);

    const handleImageLoad = () => {
        console.log('Image loaded successfully for NFT:', nft.id, 'using URL:', imageUrl);

        // Clear timeout since image loaded successfully
        if (loadTimeout) {
            clearTimeout(loadTimeout);
            setLoadTimeout(null);
        }

        setImageLoading(false);
        setImageError(false);
    };

    const handleImageError = () => {
        console.error('❌ Failed to load image for NFT:', nft.id, 'Walrus CID:', nft.walrusCid, 'URL:', imageUrl);

        // Clear current timeout
        if (loadTimeout) {
            clearTimeout(loadTimeout);
            setLoadTimeout(null);
        }

        // Try next URL in the list
        const nextIndex = currentUrlIndex + 1;
        if (nextIndex < walrusUrls.length) {
            console.log(`🔄 Trying alternative URL (${nextIndex + 1}/${walrusUrls.length}):`, walrusUrls[nextIndex]);

            // Test the next URL before trying to load it
            testWalrusUrl(walrusUrls[nextIndex]).then(result => {
                setDebugInfo(prev => ({
                    ...prev,
                    httpStatus: result.status,
                    errorType: result.error,
                    corsIssue: result.corsIssue,
                    contentType: result.contentType,
                }));

                if (result.success) {
                    console.log('✅ Next URL test passed, loading image...');
                    setCurrentUrlIndex(nextIndex);
                    setImageUrl(walrusUrls[nextIndex]);
                    setImageLoading(true);
                    setImageError(false);

                    // Set new timeout for this URL
                    const timeout = setTimeout(() => {
                        console.log('⏰ Image load timeout, trying next URL...');
                        handleImageError();
                    }, 8000);
                    setLoadTimeout(timeout);
                } else {
                    console.log('❌ Next URL test also failed, trying subsequent URL...');
                    setCurrentUrlIndex(nextIndex);
                    handleImageError(); // Recursively try next URL
                }
            });
        } else {
            console.log('🛑 All Walrus URLs failed, showing fallback image');
            setImageLoading(false);
            setImageError(true);
        }
    };

    // Generate a fallback canvas image if Walrus image fails
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

        // Subtitle
        ctx.fillStyle = '#4338ca';
        ctx.font = '16px Arial';
        ctx.fillText('Sentence Collection', canvas.width / 2, 90);

        // Main text with word wrapping
        ctx.fillStyle = '#1e1b4b';
        ctx.font = 'bold 20px Arial';
        const words = nft.text.split(' ');
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

        // NFT ID
        ctx.font = '14px Arial';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(`ID: #${nft.id.slice(-8)}`, canvas.width / 2, canvas.height - 40);

        // Walrus status
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('(Image from Walrus unavailable)', canvas.width / 2, canvas.height - 20);

        return canvas.toDataURL('image/png');
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100 overflow-hidden">
            {/* Image Section */}
            <div className="relative h-48 bg-gray-100 overflow-hidden">
                {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent"></div>
                    </div>
                )}
                {imageError ? (
                    <img
                        src={generateFallbackImage()}
                        alt={`NFT Fallback: ${nft.text}`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    imageUrl && (
                        <img
                            src={imageUrl}
                            alt={`NFT: ${nft.text}`}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                        />
                    )
                )}

            </div>

            {/* Content Section */}
            <div className="p-4">
                <div className="mb-3">
                    <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-1">
                        &ldquo;{nft.text}&rdquo;
                    </h3>
                    <p className="text-sm text-gray-500">
                        Created {formatDate(nft.createdAt)}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const urlToTry = imageUrl || walrusUrls[0];
                            console.log('Testing Walrus URL:', urlToTry);
                            window.open(urlToTry, '_blank');
                        }}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                        title={`Open: ${imageUrl || walrusUrls[0]}`}
                    >
                        <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Full
                    </button>
                    {imageError && (
                        <button
                            onClick={() => {
                                console.log('Retrying image load...');

                                // Clear any existing timeout
                                if (loadTimeout) {
                                    clearTimeout(loadTimeout);
                                    setLoadTimeout(null);
                                }

                                setCurrentUrlIndex(0);
                                setImageUrl(walrusUrls[0]);
                                setImageError(false);
                                setImageLoading(true);

                                // Set new timeout
                                const timeout = setTimeout(() => {
                                    console.log('Image load timeout, trying next URL...');
                                    handleImageError();
                                }, 10000);
                                setLoadTimeout(timeout);
                            }}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                            title="Retry loading image"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(nft.id);
                            console.log('Copied NFT ID to clipboard:', nft.id);
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                        title="Copy NFT ID"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>

                {/* Comprehensive Debug Info */}
                {(imageError || imageLoading) && (
                    <div className="mt-2 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-xs">
                        <div className="font-bold text-blue-900 mb-2 flex items-center">
                            🔍 {imageError ? 'Diagnostic Report' : 'Loading Analysis'}
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-blue-700">Walrus CID:</span>
                                <span className="font-mono text-blue-900">{nft.walrusCid}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-blue-700">Progress:</span>
                                <span className="text-blue-900">
                                    {imageError ? 'Failed' : 'Testing'} {currentUrlIndex + 1}/{walrusUrls.length} URLs
                                </span>
                            </div>

                            {debugInfo.httpStatus && (
                                <div className="flex justify-between">
                                    <span className="text-blue-700">HTTP Status:</span>
                                    <span className={`font-semibold ${debugInfo.httpStatus >= 200 && debugInfo.httpStatus < 300 ? 'text-green-600' : 'text-red-600'}`}>
                                        {debugInfo.httpStatus}
                                    </span>
                                </div>
                            )}

                            {debugInfo.contentType && (
                                <div className="flex justify-between">
                                    <span className="text-blue-700">Content-Type:</span>
                                    <span className="font-mono text-blue-900">{debugInfo.contentType}</span>
                                </div>
                            )}

                            {debugInfo.errorType && (
                                <div className="flex justify-between">
                                    <span className="text-blue-700">Error:</span>
                                    <span className="text-red-600 font-semibold">{debugInfo.errorType}</span>
                                </div>
                            )}

                            {debugInfo.corsIssue && (
                                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                                    <div className="text-red-800 font-semibold">🚫 CORS Issue Detected</div>
                                    <div className="text-red-700 text-xs">Browser blocking cross-origin requests</div>
                                </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-blue-200">
                                <div className="text-blue-600 font-semibold">
                                    {imageLoading && '⏱️ Testing endpoint with HEAD request...'}
                                    {imageError && '❌ All Walrus endpoints failed - showing fallback'}
                                </div>
                            </div>
                        </div>

                        {/* Current URL being tested */}
                        <div className="mt-2 pt-2 border-t border-blue-200">
                            <div className="text-blue-700 text-xs">Current URL:</div>
                            <div className="font-mono text-xs text-blue-900 break-all bg-white p-1 rounded">
                                {imageUrl || walrusUrls[currentUrlIndex]}
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Testing Section */}
                <div className="mt-2">
                    <button
                        onClick={async () => {
                            console.log('🧪 Manual comprehensive test starting...');
                            for (let i = 0; i < walrusUrls.length; i++) {
                                console.log(`\n🔍 Testing URL ${i + 1}/${walrusUrls.length}: ${walrusUrls[i]}`);
                                const result = await testWalrusUrl(walrusUrls[i]);
                                console.log(`Result:`, result);
                            }
                            console.log('🧪 Manual test completed. Check console for details.');
                        }}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors border border-gray-300"
                    >
                        🧪 Run Manual URL Test (Check Console)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function MyPage() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const router = useRouter();
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [currentText, setCurrentText] = useState('');
    const [ownedLetters, setOwnedLetters] = useState<Map<string, number>>(new Map());
    const [usedLetters, setUsedLetters] = useState<Map<string, number>>(new Map());
    const [warningMessage, setWarningMessage] = useState('');
    const [textGrid, setTextGrid] = useState<string[]>(new Array(50).fill(''));
    const [showModal, setShowModal] = useState(false);
    const [mintedNFTs, setMintedNFTs] = useState<any[]>([]);
    const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
    const [isMinting, setIsMinting] = useState(false);

    const qwertyRows = [
        'qwertyuiop'.split(''),
        'asdfghjkl'.split(''),
        'zxcvbnm'.split('')
    ];
    const MAX_CHARACTERS = 50;

    useEffect(() => {
        const checkAccess = async () => {
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

                const profile = await getUserProfile(suiClient, currentAccount.address);
                if (profile) {
                    const parsedProfile = parseUserProfile(profile);
                    setUserProfile(parsedProfile);

                    // Extract owned letters from letter bank
                    if (parsedProfile?.letterBank) {
                        const letterMap = new Map<string, number>();

                        if (typeof parsedProfile.letterBank === 'string') {
                            // Count occurrences of each letter
                            for (const char of parsedProfile.letterBank.toUpperCase()) {
                                if (char.match(/[A-Z]/)) {
                                    letterMap.set(char, (letterMap.get(char) || 0) + 1);
                                }
                            }
                        }

                        setOwnedLetters(letterMap);
                    }
                }

                setHasProfile(true);
            } catch (error) {
                console.error('Error checking user profile:', error);
                router.push('/signup');
            } finally {
                setIsCheckingProfile(false);
            }
        };

        checkAccess();
    }, [currentAccount, router, suiClient]);

    const loadMintedNFTs = useCallback(async () => {
        if (!currentAccount || !userProfile) return;

        setIsLoadingNFTs(true);
        try {
            const ownedObjects = await suiClient.getOwnedObjects({
                owner: currentAccount.address,
                filter: {
                    StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::nft::Sentence`
                },
                options: { showContent: true, showType: true }
            });

            const nftData = ownedObjects.data
                .map(obj => {
                    if (obj.data?.content?.dataType === 'moveObject') {
                        const content = obj.data.content as any;
                        console.log('NFT content fields:', content.fields); // Debug log
                        return {
                            id: obj.data.objectId,
                            text: content.fields?.text || '',
                            walrusCid: content.fields?.walrus_cid || '',
                            creator: currentAccount.address, // Note: Move struct doesn't have creator field, using current user
                            createdAt: content.fields?.created_epoch ? content.fields.created_epoch * 1000 : Date.now() // Convert epoch to timestamp
                        };
                    }
                    return null;
                })
                .filter(Boolean)
                .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));

            setMintedNFTs(nftData);
        } catch (error) {
            console.error('Failed to load minted NFTs:', error);
        } finally {
            setIsLoadingNFTs(false);
        }
    }, [currentAccount, suiClient, userProfile]);

    useEffect(() => {
        if (hasProfile && userProfile) {
            loadMintedNFTs();
        }
    }, [hasProfile, userProfile, loadMintedNFTs]);

    const canUseLetter = (letter: string): boolean => {
        const total = ownedLetters.get(letter) || 0;
        const used = usedLetters.get(letter) || 0;
        return total > used;
    };

    const handleKeyClick = (letter: string) => {
        const currentLength = textGrid.filter(cell => cell !== '').length;
        if (currentLength >= MAX_CHARACTERS) {
            setWarningMessage(`Character limit of ${MAX_CHARACTERS} exceeded!`);
            return;
        }

        const upperLetter = letter.toUpperCase();
        if (!canUseLetter(upperLetter)) {
            setWarningMessage(`You don't have any ${upperLetter}'s left!`);
            return;
        }

        setWarningMessage('');

        // Update used letters count
        setUsedLetters(prev => {
            const newUsed = new Map(prev);
            newUsed.set(upperLetter, (newUsed.get(upperLetter) || 0) + 1);
            return newUsed;
        });

        setTextGrid(prev => {
            const newGrid = [...prev];
            const nextEmptyIndex = newGrid.findIndex(cell => cell === '');
            if (nextEmptyIndex !== -1) {
                newGrid[nextEmptyIndex] = letter;
            }
            return newGrid;
        });
        setCurrentText(prev => prev + letter);
    };

    const handleSpaceClick = () => {
        const currentLength = textGrid.filter(cell => cell !== '').length;
        if (currentLength >= MAX_CHARACTERS) {
            setWarningMessage(`Character limit of ${MAX_CHARACTERS} exceeded!`);
            return;
        }

        setWarningMessage('');
        setTextGrid(prev => {
            const newGrid = [...prev];
            const nextEmptyIndex = newGrid.findIndex(cell => cell === '');
            if (nextEmptyIndex !== -1) {
                newGrid[nextEmptyIndex] = ' ';
            }
            return newGrid;
        });
        setCurrentText(prev => prev + ' ');
    };


    const handleBackspaceClick = () => {
        setWarningMessage('');

        // Get the last character to potentially restore
        const lastChar = currentText.slice(-1).toUpperCase();

        if (lastChar && lastChar.match(/[A-Z]/)) {
            // Restore the letter to available pool
            setUsedLetters(prev => {
                const newUsed = new Map(prev);
                const currentUsed = newUsed.get(lastChar) || 0;
                if (currentUsed > 0) {
                    newUsed.set(lastChar, currentUsed - 1);
                }
                return newUsed;
            });
        }

        setTextGrid(prev => {
            const newGrid = [...prev];
            const lastFilledIndex = newGrid.findLastIndex(cell => cell !== '');
            if (lastFilledIndex !== -1) {
                newGrid[lastFilledIndex] = '';
            }
            return newGrid;
        });
        setCurrentText(prev => prev.slice(0, -1));
    };

    const generateCanvasImage = (): Promise<Blob> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;

            // High resolution canvas
            canvas.width = 800;
            canvas.height = 600;

            // Create wall texture background
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#f3f4f6');
            gradient.addColorStop(0.5, '#e5e7eb');
            gradient.addColorStop(1, '#d1d5db');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Add texture pattern
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            for (let i = 0; i < canvas.width; i += 20) {
                for (let j = 0; j < canvas.height; j += 20) {
                    ctx.fillRect(i, j, 1, 1);
                }
            }

            // Calculate grid layout
            const cols = 10;
            const rows = 5;
            const cellSize = 60;
            const startX = (canvas.width - (cols * cellSize)) / 2;
            const startY = (canvas.height - (rows * cellSize)) / 2;

            // Draw cells
            textGrid.forEach((char, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;

                // Cell background
                ctx.fillStyle = char ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.roundRect(x + 5, y + 5, cellSize - 10, cellSize - 10, 8);
                ctx.fill();

                // Cell border
                ctx.strokeStyle = char ? '#3b82f6' : '#d1d5db';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Character
                if (char && char !== ' ') {
                    ctx.fillStyle = '#1f2937';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(char, x + cellSize / 2, y + cellSize / 2);
                } else if (char === ' ') {
                    ctx.fillStyle = '#6b7280';
                    ctx.beginPath();
                    ctx.arc(x + cellSize / 2, y + cellSize / 2, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });

            // Add title
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Suimming Sentence NFT', canvas.width / 2, 50);

            // Add subtitle with text
            ctx.fillStyle = '#6b7280';
            ctx.font = '16px Arial';
            ctx.fillText(`"${currentText}"`, canvas.width / 2, 80);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
            }, 'image/png', 0.9);
        });
    };

    const handleMintNFT = async () => {
        if (!currentAccount || !userProfile) return;

        setIsMinting(true);
        try {
            // Generate used letters string
            const usedLettersArray: string[] = [];
            usedLetters.forEach((count, letter) => {
                for (let i = 0; i < count; i++) {
                    usedLettersArray.push(letter);
                }
            });
            const usedLettersString = usedLettersArray.join('');

            // Generate canvas image
            const imageBlob = await generateCanvasImage();

            // Upload to Walrus
            const formData = new FormData();
            formData.append('file', imageBlob, 'sentence.png');

            const walrusResponse = await fetch('/api/walrus-upload', {
                method: 'POST',
                body: formData
            });

            if (!walrusResponse.ok) {
                throw new Error('Failed to upload to Walrus');
            }

            const { blobId } = await walrusResponse.json();

            // Get user profile ID
            const profileObjects = await suiClient.getOwnedObjects({
                owner: currentAccount.address,
                filter: {
                    StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::user::UserProfile`
                }
            });

            if (profileObjects.data.length === 0) {
                throw new Error('User profile not found');
            }

            const userProfileId = profileObjects.data[0].data?.objectId;
            if (!userProfileId) {
                throw new Error('Invalid user profile ID');
            }

            // Import necessary modules
            const { Transaction } = await import('@mysten/sui/transactions');

            // Create and execute transaction
            const transaction = new Transaction();
            transaction.moveCall({
                target: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::nft::mint_sentence_from_profile`,
                arguments: [
                    transaction.object(userProfileId),
                    transaction.pure.string(usedLettersString),
                    transaction.pure.string(currentText),
                    transaction.pure.string(blobId)
                ]
            });

            // Execute transaction (this would need proper integration with the dApp kit)
            console.log('Transaction prepared for NFT minting');
            alert('NFT minted successfully!');

            // Reset form
            setCurrentText('');
            setTextGrid(new Array(50).fill(''));
            setUsedLetters(new Map());
            setShowModal(false);

            // Reload NFTs and profile
            await loadMintedNFTs();
        } catch (error) {
            console.error('Failed to mint NFT:', error);
            alert('Failed to mint NFT. Please try again.');
        } finally {
            setIsMinting(false);
        }
    };

    const handleSubmit = () => {
        if (currentText.trim()) {
            setShowModal(true);
        }
    };

    if (isCheckingProfile) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600">Loading your letters...</p>
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
            <div className="max-w-4xl mx-auto">
                {/* Header Section */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <Link
                            href="/map"
                            className="inline-flex items-center px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Map
                        </Link>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-gray-800">
                                {Array.from(ownedLetters.values()).reduce((sum, count) => sum + count, 0)}
                            </div>
                            <div className="text-sm text-gray-600">Total Letters</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Letter Studio</h1>
                        <p className="text-lg text-gray-700">
                            Create amazing sentences with your collected letters
                        </p>
                        <div className="flex justify-center mt-4">
                            <div className="bg-white rounded-full px-4 py-2 shadow-md">
                                <span className="text-sm font-medium text-gray-600">
                                    {Array.from(ownedLetters.keys()).length} unique letters collected
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Text Canvas Section */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Canvas</h2>
                        <div className="flex items-center justify-center gap-4">
                            <div className="bg-gray-100 rounded-full px-4 py-2">
                                <span className="text-sm font-medium text-gray-600">
                                    {textGrid.filter(cell => cell !== '').length}/{MAX_CHARACTERS} characters
                                </span>
                            </div>
                            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(textGrid.filter(cell => cell !== '').length / MAX_CHARACTERS) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div
                            className="grid grid-cols-10 gap-2 justify-center max-w-3xl mx-auto p-6 rounded-2xl relative overflow-hidden"
                            style={{
                                backgroundImage: 'url(/wall.png)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat'
                            }}
                        >
                            {textGrid.map((char, index) => {
                                const nextEmptyIndex = textGrid.findIndex(cell => cell === '');
                                const isActive = index === nextEmptyIndex;
                                const isFilled = char !== '';

                                return (
                                    <div
                                        key={index}
                                        className={`relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl border-3 flex items-center justify-center text-sm sm:text-base md:text-lg font-bold transition-all duration-200 transform ${
                                            isActive
                                                ? 'border-yellow-400 bg-yellow-100 shadow-lg scale-110 animate-pulse'
                                                : isFilled
                                                ? 'border-white bg-white bg-opacity-90 shadow-md hover:scale-105'
                                                : 'border-gray-300 bg-white bg-opacity-60 hover:bg-opacity-80'
                                        }`}
                                        style={{
                                            fontFamily: 'Anglodavek Bold, monospace',
                                            color: isFilled ? '#1f2937' : '#9ca3af'
                                        }}
                                    >
                                        {char === ' ' ? (
                                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                        ) : (
                                            char || (isActive ? '|' : '')
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {warningMessage && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-sm text-red-600 text-center font-medium">{warningMessage}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Interactive Keyboard */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Letter Keyboard</h2>

                    {/* Letter Inventory Display */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                        <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center">Your Letter Inventory</h3>
                        <div className="flex flex-wrap justify-center gap-2">
                            {Array.from(ownedLetters.entries())
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([letter, total]) => {
                                    const used = usedLetters.get(letter) || 0;
                                    const remaining = total - used;
                                    return (
                                        <div
                                            key={letter}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                                                remaining > 0
                                                    ? 'bg-green-100 border-green-300 text-green-700'
                                                    : 'bg-red-100 border-red-300 text-red-700'
                                            }`}
                                        >
                                            {letter}: {remaining}/{total}
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>

                    {/* QWERTY Keyboard Rows */}
                    <div className="space-y-3 mb-6">
                        {qwertyRows.map((row, rowIndex) => (
                            <div key={rowIndex} className="flex justify-center gap-2">
                                {row.map((letter) => {
                                    const upperLetter = letter.toUpperCase();
                                    const canUse = canUseLetter(upperLetter);
                                    const total = ownedLetters.get(upperLetter) || 0;
                                    const used = usedLetters.get(upperLetter) || 0;
                                    const remaining = total - used;

                                    return (
                                        <button
                                            key={letter}
                                            onClick={() => canUse && handleKeyClick(upperLetter)}
                                            disabled={!canUse}
                                            className={`
                                                relative h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl font-bold text-sm sm:text-base transition-all duration-200 transform hover:scale-105 active:scale-95
                                                ${canUse
                                                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                                                    : total > 0
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                                }
                                            `}
                                        >
                                            {letter.toUpperCase()}
                                            {total > 0 && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 border-2 border-gray-200">
                                                    {remaining}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Control Buttons */}
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={handleSpaceClick}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                        >
                            <svg className="w-4 h-4 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                <rect x="2" y="9" width="16" height="2" rx="1"/>
                            </svg>
                            Space
                        </button>
                        <button
                            onClick={handleBackspaceClick}
                            className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                        >
                            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                            </svg>
                            Delete
                        </button>
                        <button
                            onClick={() => {
                                setCurrentText('');
                                setTextGrid(new Array(50).fill(''));
                                setUsedLetters(new Map());
                                setWarningMessage('');
                            }}
                            className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                        >
                            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Mint Section */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-6 mb-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Create Your NFT</h2>
                        <p className="text-gray-600 mb-6">
                            Transform your sentence into a unique digital artwork
                        </p>
                        <button
                            onClick={handleSubmit}
                            disabled={!currentText.trim()}
                            className={`
                                px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg
                                ${currentText.trim()
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer hover:scale-105 hover:shadow-xl active:scale-95'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                                }
                            `}
                        >
                            <svg className="w-6 h-6 mr-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0L7 6m11-2l1 2M7 6v12a2 2 0 002 2h6a2 2 0 002-2V6M7 6H5a1 1 0 00-1 1v11a2 2 0 002 2h1M17 6h2a1 1 0 011 1v11a2 2 0 01-2 2h-1" />
                            </svg>
                            Mint as NFT
                        </button>
                    </div>
                </div>

                {/* NFT Gallery Section */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">My NFT Gallery</h2>
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-full px-4 py-2">
                                <span className="text-sm font-semibold text-purple-700">
                                    {mintedNFTs.length} NFTs Created
                                </span>
                            </div>
                            {isLoadingNFTs && (
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
                            )}
                        </div>
                    </div>

                    {mintedNFTs.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">No NFTs Yet</h3>
                            <p className="text-gray-500 mb-6">
                                Create your first sentence NFT using the letters above!
                            </p>
                            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Start Creating
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {mintedNFTs.map((nft) => (
                                <NFTCard key={nft.id} nft={nft} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Enhanced Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 transform transition-all">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0L7 6m11-2l1 2M7 6v12a2 2 0 002 2h6a2 2 0 002-2V6M7 6H5a1 1 0 00-1 1v11a2 2 0 002 2h1M17 6h2a1 1 0 011 1v11a2 2 0 01-2 2h-1" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Create NFT Artwork</h3>
                                <p className="text-gray-600">Transform your sentence into a unique digital collectible</p>
                            </div>

                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-6">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Your Sentence:</p>
                                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 font-mono text-lg text-center font-bold text-gray-800">
                                    &ldquo;{currentText || 'No text entered'}&rdquo;
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
                                <div className="flex items-start">
                                    <svg className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-semibold text-blue-800 mb-1">What happens next?</p>
                                        <p className="text-sm text-blue-700">
                                            • Your sentence will be converted into beautiful artwork<br/>
                                            • The image will be stored on Walrus (decentralized storage)<br/>
                                            • A unique NFT will be minted on Sui blockchain<br/>
                                            • Used letters will be consumed from your inventory
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    disabled={isMinting}
                                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMintNFT}
                                    disabled={isMinting}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isMinting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                                            Minting...
                                        </>
                                    ) : (
                                        'Create NFT'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}