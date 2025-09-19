'use client';

import { useState } from 'react';

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider: string;
}

interface ZKLoginProps {
  onLogin: (provider: string, userInfo: UserInfo) => void;
}

export default function ZKLogin({ onLogin }: ZKLoginProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsLoading(provider);

    try {
      // Simulate ZK-login process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock user data - in real implementation this would come from ZK-login
      const mockUserData = {
        google: {
          id: 'google_123456',
          email: 'user@gmail.com',
          name: 'John Doe',
          picture: 'https://via.placeholder.com/40',
          provider: 'google'
        },
        apple: {
          id: 'apple_123456',
          email: 'user@privaterelay.appleid.com',
          name: 'John Doe',
          provider: 'apple'
        }
      };

      onLogin(provider, mockUserData[provider]);
    } catch {
      setError(`Failed to login with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg border">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">ZK-Login</h3>
        <p className="text-sm text-gray-600">Secure social login with zero-knowledge proofs</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => handleSocialLogin('google')}
          disabled={isLoading !== null}
          className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading === 'google' ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              Authenticating...
            </div>
          ) : (
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </div>
          )}
        </button>

        <button
          onClick={() => handleSocialLogin('apple')}
          disabled={isLoading !== null}
          className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading === 'apple' ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Authenticating...
            </div>
          ) : (
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </div>
          )}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs text-blue-800 font-medium mb-1">Zero-Knowledge Privacy</p>
              <p className="text-xs text-blue-700">
                Your personal information is never shared. ZK-proofs verify your identity without exposing your data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}