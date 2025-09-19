'use client';

import {
	useConnectWallet,
	useCurrentAccount,
	useWallets,
	useDisconnectWallet
} from '@mysten/dapp-kit';
import { isEnokiWallet } from '@mysten/enoki';
import { useState, useEffect } from 'react';

export default function ConnectWallet() {
	const currentAccount = useCurrentAccount();
	const { mutate: connect } = useConnectWallet();
	const { mutate: disconnect } = useDisconnectWallet();
	const wallets = useWallets();
	const [isConnecting, setIsConnecting] = useState<string | null>(null);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const enokiWallets = isMounted ? wallets.filter(isEnokiWallet) : [];
	const standardWallets = isMounted ? wallets.filter(wallet => !isEnokiWallet(wallet)) : [];

	const handleConnect = async (wallet: ReturnType<typeof useWallets>[0]) => {
		setIsConnecting(wallet.name);
		try {
			connect({ wallet });
		} catch (error) {
			console.error('Failed to connect wallet:', error);
		} finally {
			setIsConnecting(null);
		}
	};

	const handleDisconnect = () => {
		disconnect();
	};

	if (currentAccount) {
		return (
			<div className="flex flex-col items-center space-y-4 p-6 border-2 border-emerald-200 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50">
				<div className="text-center">
					<div className="flex items-center justify-center space-x-2 mb-2">
						<div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
						<span className="text-xl">🏊‍♂️</span>
						<h3 className="text-lg font-bold text-emerald-800">Connected</h3>
					</div>
					<p className="text-xs text-gray-500">
						Ready to start collecting letters
					</p>
				</div>

				<div className="flex space-x-2">
					<button
						onClick={handleDisconnect}
						className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
					>
						🔌 Disconnect
					</button>
				</div>
			</div>
		);
	}

	// Show loading state during initial mount to prevent hydration mismatch
	if (!isMounted) {
		return (
			<div className="max-w-md mx-auto">
				<div className="text-center mb-6">
					<h2 className="text-2xl font-bold text-gray-900">Connect Your Wallet</h2>
					<p className="text-gray-600 mt-2">Loading wallet options...</p>
				</div>
				<div className="bg-white p-8 border rounded-lg">
					<div className="flex justify-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-md mx-auto">

			{/* Enoki Social Wallets */}
			{enokiWallets.length > 0 && (
				<div className="mb-6">
					<h3 className="text-lg font-semibold mb-3 text-gray-800">Social Login</h3>
					<div className="space-y-2">
						{enokiWallets.map((wallet) => {
							const isEnokiConnecting = isConnecting === wallet.name;
							const getProviderIcon = (provider: string) => {
								switch ((provider || 'unknown').toLowerCase()) {
									case 'google':
										return 'G';
									case 'facebook':
										return '📘';
									case 'twitch':
										return '🟣';
									default:
										return '🔗';
								}
							};

							return (
								<button
									key={wallet.name}
									onClick={() => handleConnect(wallet)}
									disabled={isEnokiConnecting}
									className={`
                    w-full flex items-center space-x-3 p-4 border rounded-lg transition-colors
                    ${isEnokiConnecting
											? 'bg-gray-100 cursor-not-allowed opacity-50'
											: 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
										}
                  `}
								>
									<div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-lg">
										{getProviderIcon((wallet as { provider?: string })?.provider || 'unknown')}
									</div>
									<div className="flex-1 text-left">
										<div className="font-medium text-gray-900">
											{wallet.name}
										</div>
										<div className="text-xs text-gray-500">
											Zero-knowledge social login
										</div>
										{isEnokiConnecting && (
											<div className="text-sm text-gray-500">Connecting...</div>
										)}
									</div>
									{!isEnokiConnecting && (
										<div className="text-gray-400">→</div>
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Standard Sui Wallets */}
			{standardWallets.length > 0 && (
				<div className="mb-6">
					<h3 className="text-lg font-semibold mb-3 text-gray-800">Browser Extension Wallets</h3>
					<div className="space-y-2">
						{standardWallets.map((wallet) => {
							const isWalletConnecting = isConnecting === wallet.name;
							return (
								<button
									key={wallet.name}
									onClick={() => handleConnect(wallet)}
									disabled={isWalletConnecting}
									className={`
                    w-full flex items-center space-x-3 p-4 border rounded-lg transition-colors
                    ${isWalletConnecting
											? 'bg-gray-100 cursor-not-allowed opacity-50'
											: 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
										}
                  `}
								>
									{wallet.icon && (
										<img
											src={wallet.icon}
											alt={wallet.name}
											className="w-8 h-8 rounded-full"
										/>
									)}
									<div className="flex-1 text-left">
										<div className="font-medium text-gray-900">
											{wallet.name}
										</div>
										{isWalletConnecting && (
											<div className="text-sm text-gray-500">Connecting...</div>
										)}
									</div>
									{!isWalletConnecting && (
										<div className="text-gray-400">→</div>
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}