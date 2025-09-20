'use client';

import React from 'react';
import CheckpointsList from '@/app/components/CheckpointsList';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';

/**
 * Demo page showing all checkpoint coordinates from the blockchain
 * This page demonstrates how to use the checkpoint querying functionality
 */
export default function CheckpointsPage() {
  const currentAccount = useCurrentAccount();
  const router = useRouter();

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Checkpoints List</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to view checkpoints from the blockchain.</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkpoint Coordinates</h1>
          <p className="mt-2 text-gray-600">
            All checkpoints from the Suimming blockchain with their latitude and longitude coordinates
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Demo</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>What this component does:</strong> Queries all Checkpoint objects from the Sui blockchain
              and extracts their latitude and longitude coordinates.
            </p>
            <p>
              <strong>Current implementation:</strong> Uses placeholder metadata since real Walrus integration
              is not yet implemented. In production, coordinates would be fetched from Walrus storage.
            </p>
            <p>
              <strong>Usage:</strong> Import <code className="bg-gray-100 px-1 rounded">useCheckpoints</code> hook
              or <code className="bg-gray-100 px-1 rounded">useCheckpointCoordinates</code> for just the coordinates.
            </p>
          </div>
        </div>

        <CheckpointsList />

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="text-sm text-blue-600 hover:text-blue-900 flex items-center"
          >
            Create Checkpoint
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}