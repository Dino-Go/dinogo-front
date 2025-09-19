'use client';

import { useState } from 'react';
import Link from 'next/link';
import SlushWalletLogin from '@/components/SlushWalletLogin';
import ZKLogin from '@/components/ZKLogin';

export default function Home() {
  const [user, setUser] = useState<{ type: 'wallet'; address: string } | { type: 'zk'; provider: string; email: string; name?: string; id: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'wallet' | 'zk'>('wallet');

  const handleWalletLogin = (address: string) => {
    setUser({ type: 'wallet', address });
  };

  const handleZKLogin = (provider: string, userInfo: { id: string; email: string; name?: string; provider: string }) => {
    setUser({ type: 'zk', provider, ...userInfo });
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
            <p className="text-gray-600 mb-4">You are successfully logged in</p>

            {user.type === 'wallet' && (
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-800 font-medium">Wallet Address</p>
                <p className="text-xs text-blue-600 break-all">{user.address}</p>
              </div>
            )}

            {user.type === 'zk' && (
              <div className="bg-green-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-green-800 font-medium">ZK-Login via {user.provider}</p>
                <p className="text-xs text-green-600">{user.email}</p>
                {user.name && <p className="text-xs text-green-600">{user.name}</p>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Link
              href="/map"
              className="w-full inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl text-center"
            >
              Go to Map
            </Link>

            <button
              onClick={handleLogout}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Suimming</h1>
          <p className="text-lg text-gray-600">Choose your preferred login method to get started</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'wallet'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Slush Wallet
            </button>
            <button
              onClick={() => setActiveTab('zk')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'zk'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ZK-Login
            </button>
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'wallet' && <SlushWalletLogin onLogin={handleWalletLogin} />}
            {activeTab === 'zk' && <ZKLogin onLogin={handleZKLogin} />}
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-600 mb-4">Or continue without logging in</p>
          <Link
            href="/map"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Go to Map
          </Link>
        </div>
      </div>
    </div>
  );
}