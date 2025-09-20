'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import WebGLMapOverlay from "@/app/components/WebGLMapOverlay";
import { hasUserProfile } from "@/utils/userProfile";

export default function MapPage() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const router = useRouter();
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);

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

    if (isCheckingProfile) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600">Loading map...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!hasProfile) {
        return null; // This should not render as the user will be redirected
    }

    return (
        <div className="relative w-full h-screen">
            <WebGLMapOverlay className="w-full h-screen" />
        </div>
    );
}