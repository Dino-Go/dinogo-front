'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { hasUserProfile, getUserProfile, parseUserProfile } from "@/utils/userProfile";

export default function MyPage() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const router = useRouter();
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [currentText, setCurrentText] = useState('');
    const [ownedLetters, setOwnedLetters] = useState<string[]>([]);
    const [warningMessage, setWarningMessage] = useState('');
    const [textGrid, setTextGrid] = useState<string[]>(new Array(50).fill(''));
    const [showModal, setShowModal] = useState(false);

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
                        // Assuming letterBank is an array of letters or letter objects
                        // This might need adjustment based on the actual data structure
                        const letters = Array.isArray(parsedProfile.letterBank)
                            ? parsedProfile.letterBank.map((item: any) =>
                                typeof item === 'string' ? item.toUpperCase() : item.letter?.toUpperCase() || ''
                              ).filter(Boolean)
                            : [];
                        setOwnedLetters(letters);
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

    const handleKeyClick = (letter: string) => {
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

    const handleSubmit = () => {
        if (currentText.trim()) {
            setShowModal(true);
        }
    };

    const handleMintNFT = () => {
        console.log('Minting NFT with text:', currentText);
        // Here you would implement the actual NFT minting logic
        alert('NFT minted successfully!');
        setCurrentText('');
        setTextGrid(new Array(50).fill(''));
        setShowModal(false);
    };

    const isLetterOwned = (letter: string) => {
        return ownedLetters.includes(letter);
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
                {/* Back to Map Button */}
                <div className="mb-6">
                    <Link
                        href="/map"
                        className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                    >
                        ← Back to Map
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">My Page</h1>
                    <p className="text-lg text-gray-600">
                        You own {ownedLetters.length} letters
                    </p>
                    <p className="text-md text-gray-500">
                        Use your letters to build words.
                    </p>
                </div>

                {/* Text Grid */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
                        Current sentence ({textGrid.filter(cell => cell !== '').length}/{MAX_CHARACTERS} characters)
                    </label>
                    <div
                        className="grid grid-cols-10 gap-1 sm:gap-2 justify-center max-w-2xl mx-auto p-2 sm:p-4 rounded-lg"
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

                            return (
                                <div
                                    key={index}
                                    className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-bold text-black transition-colors opacity-50 ${
                                        isActive
                                            ? 'border-blue-500 bg-blue-100'
                                            : 'border-gray-300 bg-white'
                                    }`}
                                    style={{ fontFamily: 'Anglodavek Bold, monospace' }}
                                >
                                    {char === ' ' ? '·' : char}
                                </div>
                            );
                        })}
                    </div>
                    {warningMessage && (
                        <p className="mt-4 text-sm text-red-600 text-center">{warningMessage}</p>
                    )}
                </div>

                {/* Keyboard */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    {/* QWERTY Keyboard Rows */}
                    <div className="space-y-1 sm:space-y-2 mb-4">
                        {qwertyRows.map((row, rowIndex) => (
                            <div key={rowIndex} className="flex justify-center gap-1 sm:gap-2">
                                {row.map((letter) => {
                                    const owned = isLetterOwned(letter.toUpperCase());
                                    return (
                                        <button
                                            key={letter}
                                            onClick={() => owned && handleKeyClick(letter.toUpperCase())}
                                            disabled={!owned}
                                            className={`
                                                h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full font-medium text-xs sm:text-sm transition-colors
                                                ${owned
                                                    ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                }
                                            `}
                                        >
                                            {letter}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Bottom Row: Space, Backspace */}
                    <div className="flex justify-center gap-2 sm:gap-4">
                        <button
                            onClick={handleSpaceClick}
                            className="w-12 h-8 sm:w-16 sm:h-10 md:h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium text-xs transition-colors"
                        >
                            Space
                        </button>
                        <button
                            onClick={handleBackspaceClick}
                            className="w-12 h-8 sm:w-16 sm:h-10 md:h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium text-sm sm:text-lg transition-colors"
                        >
                            ⌫
                        </button>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="text-center">
                    <button
                        onClick={handleSubmit}
                        disabled={!currentText.trim()}
                        className={`
                            px-8 py-3 rounded-lg font-medium text-lg transition-colors
                            ${currentText.trim()
                                ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        Mint as NFT
                    </button>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Mint as NFT</h3>

                            <div className="mb-4">
                                <p className="text-gray-600 mb-2">Your text:</p>
                                <div className="bg-gray-100 p-3 rounded border font-mono text-sm">
                                    {currentText || 'No text entered'}
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-600 text-sm">
                                    This will mint your text as an NFT on the blockchain. Are you sure you want to proceed?
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMintNFT}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                                >
                                    Mint NFT
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}