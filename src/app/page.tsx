'use client';

import React, { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import ConnectWallet from "@/app/components/ConnectWallet";
import { hasUserProfile } from "@/utils/userProfile";

export default function Home() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const router = useRouter();
    const [isCheckingProfile, setIsCheckingProfile] = useState(false);

    useEffect(() => {
        const checkUserProfileAndRedirect = async () => {
            if (currentAccount) {
                setIsCheckingProfile(true);
                try {
                    const profileExists = await hasUserProfile(suiClient, currentAccount.address);

                    if (profileExists) {
                        router.push('/map');
                    } else {
                        router.push('/signup');
                    }
                } catch (error) {
                    console.error('Error checking user profile:', error);
                    // If there's an error, default to signup
                    router.push('/signup');
                } finally {
                    setIsCheckingProfile(false);
                }
            }
        };

        checkUserProfileAndRedirect();
    }, [currentAccount, router, suiClient]);

    if (isCheckingProfile) {
        return (
            <div className="min-h-screen bg-[#F5F5DC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="bg-[#DEB887] py-8 px-4 shadow-lg border-4 border-[#8B4513] sm:rounded-lg sm:px-10">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20B2AA] mb-4"></div>
                            <p className="text-[#8B4513] font-bold">Checking your profile...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5DC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/dino-192x192.png"
                            alt="Suimming Logo"
                            className="w-24 h-24 pixelated"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    </div>
                    <p className="text-[#8B4513] font-bold text-lg">Connect your wallet to start collecting letters</p>
                </div>

                <div className="bg-[#DEB887] py-8 px-4 shadow-lg border-4 border-[#8B4513] sm:rounded-lg sm:px-10">
                    <ConnectWallet />
                </div>
            </div>
        </div>
    );
}