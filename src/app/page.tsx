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
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600">Checking your profile...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Walk Word World</h1>
                    <p className="text-gray-600 mt-2">Connect your wallet to start collecting letters</p>
                </div>

                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <ConnectWallet />
                </div>
            </div>
        </div>
    );
}