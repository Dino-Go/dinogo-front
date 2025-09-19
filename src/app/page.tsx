'use client';

import React, { useEffect } from "react";
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import ConnectWallet from "./components/ConnectWallet";

export default function Home() {
    const currentAccount = useCurrentAccount();
    const router = useRouter();

    useEffect(() => {
        if (currentAccount) {
            // Redirect to map page when logged in
            router.push('/map');
        }
    }, [currentAccount, router]);

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