'use client';

import { useState } from 'react';

interface SlushWalletLoginProps {
  onLogin: (address: string) => void;
}

export default function SlushWalletLogin({ onLogin }: SlushWalletLoginProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    // Basic validation for wallet address format
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 66) {
      setError('Please enter a valid Sui wallet address (0x...)');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      onLogin(walletAddress);
    } catch {
      setError('Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const connectSlushWallet = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Check if Slush wallet is available
      if (typeof window !== 'undefined' && (window as { slush?: { connect: () => Promise<string[]> } }).slush) {
        const accounts = await (window as { slush: { connect: () => Promise<string[]> } }).slush.connect();
        if (accounts && accounts.length > 0) {
          onLogin(accounts[0]);
        } else {
          setError('No accounts found in Slush wallet');
        }
      } else {
        setError('Slush wallet not detected. Please install Slush wallet extension.');
      }
    } catch {
      setError('Failed to connect to Slush wallet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg border">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Slush Wallet</h3>
        <p className="text-sm text-gray-600">Connect your Slush wallet or enter address manually</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={connectSlushWallet}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Connecting...
            </div>
          ) : (
            'Connect Slush Wallet'
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Address
            </label>
            <input
              id="wallet-address"
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Connecting...' : 'Connect with Address'}
          </button>
        </form>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}