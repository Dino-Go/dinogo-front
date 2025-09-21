'use client';

import React, { useState } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction, useDisconnectWallet } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/Toaster';

export default function SignupPage() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const router = useRouter();
    const { addNotification } = useToast();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const { mutate: disconnectWallet } = useDisconnectWallet();

    const [formData, setFormData] = useState({
        displayName: '',
        bio: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentAccount) {
            addNotification('error', 'Please connect your wallet first');
            return;
        }

        setIsLoading(true);

        try {
            // First, create the profile
            const createTransaction = new Transaction();
            const moveTarget = `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::user::create_profile`;

            console.log('Creating profile with Move target:', moveTarget);
            console.log('Package ID:', process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID);

            createTransaction.moveCall({
                target: moveTarget,
            });

            // Execute the transaction using the hook
            await new Promise((resolve, reject) => {
                signAndExecuteTransaction(
                    { transaction: createTransaction },
                    {
                        onSuccess: (result) => {
                            console.log('Profile creation transaction successful:', result);
                            resolve(result);
                        },
                        onError: (error) => {
                            console.error('Profile creation transaction failed:', error);
                            reject(error);
                        }
                    }
                );
            });

            console.log('Profile created successfully!');

            // If user provided display name or bio, update the profile
            if (formData.displayName.trim() || formData.bio.trim()) {
                // Wait a moment for the profile to be created
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Get the created profile object
                const profileObjects = await suiClient.getOwnedObjects({
                    owner: currentAccount.address,
                    filter: {
                        StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::user::UserProfile`
                    }
                });

                if (profileObjects.data.length > 0) {
                    const profileId = profileObjects.data[0].data?.objectId;

                    if (profileId) {
                        const updateTransaction = new Transaction();

                        const displayNameOption = formData.displayName.trim()
                            ? [formData.displayName.trim()]
                            : [];

                        const bioOption = formData.bio.trim()
                            ? [formData.bio.trim()]
                            : [];

                        updateTransaction.moveCall({
                            target: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::user::update_profile`,
                            arguments: [
                                updateTransaction.object(profileId),
                                updateTransaction.pure.option('string', displayNameOption.length > 0 ? displayNameOption[0] : null),
                                updateTransaction.pure.option('string', bioOption.length > 0 ? bioOption[0] : null)
                            ]
                        });

                        await new Promise((resolve, reject) => {
                            signAndExecuteTransaction(
                                { transaction: updateTransaction },
                                {
                                    onSuccess: (result) => resolve(result),
                                    onError: (error) => reject(error)
                                }
                            );
                        });
                    }
                }
            }

            addNotification('success', 'Profile created successfully!');
            setTimeout(() => router.push('/map'), 2000);
        } catch (error) {
            console.error('Error creating profile:', error);
            addNotification('error', 'Failed to create profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        // Disconnect wallet before returning to home page
        disconnectWallet();
        router.push('/');
    };

    if (!currentAccount) {
        return (
            <div className="min-h-screen bg-[#F5F5DC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <h2 className="text-2xl font-bold text-[#8B4513] mb-4">Wallet Required</h2>
                    <p className="text-[#8B4513] mb-6">Please connect your wallet first to create a profile.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex justify-center py-2 px-4 border-2 border-[#8B4513] shadow-lg text-sm font-bold rounded-md text-white bg-[#20B2AA] hover:bg-[#1E9E9E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#20B2AA]"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5DC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-[#8B4513]">Welcome to Suimming!</h1>
                    <p className="text-[#8B4513] mt-2">Create your player profile to start collecting letters</p>
                </div>

                <div className="bg-[#DEB887] py-8 px-4 shadow-lg border-4 border-[#8B4513] sm:rounded-lg sm:px-10">
                    <form onSubmit={handleCreateProfile} className="space-y-6">
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-bold text-[#8B4513]">
                                Display Name (Optional)
                            </label>
                            <div className="mt-1">
                                <input
                                    id="displayName"
                                    name="displayName"
                                    type="text"
                                    value={formData.displayName}
                                    onChange={handleInputChange}
                                    placeholder="Enter your display name"
                                    className="appearance-none block w-full px-3 py-2 border-2 border-[#8B4513] rounded-md placeholder-[#8B4513] bg-[#F5F5DC] text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:border-[#20B2AA]"
                                    maxLength={50}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="bio" className="block text-sm font-bold text-[#8B4513]">
                                Bio (Optional)
                            </label>
                            <div className="mt-1">
                                <textarea
                                    id="bio"
                                    name="bio"
                                    rows={3}
                                    value={formData.bio}
                                    onChange={handleInputChange}
                                    placeholder="Tell us about yourself..."
                                    className="appearance-none block w-full px-3 py-2 border-2 border-[#8B4513] rounded-md placeholder-[#8B4513] bg-[#F5F5DC] text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:border-[#20B2AA]"
                                    maxLength={200}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border-2 border-[#8B4513] rounded-md shadow-lg text-sm font-bold text-white bg-[#20B2AA] hover:bg-[#1E9E9E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#20B2AA] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Creating Profile...' : 'Create Profile'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSkip}
                                className="w-full flex justify-center py-2 px-4 border-2 border-[#8B4513] rounded-md shadow-lg text-sm font-bold text-[#8B4513] bg-[#F5F5DC] hover:bg-[#FFFACD] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#20B2AA]"
                            >
                                Return to Home Page
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t-2 border-[#8B4513]" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-[#DEB887] text-[#8B4513] font-bold">Connected Wallet</span>
                            </div>
                        </div>
                        <div className="mt-3 text-center">
                            <p className="text-sm text-[#8B4513] break-all font-mono">
                                {currentAccount.address}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}