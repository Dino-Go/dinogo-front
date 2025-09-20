'use client';

import React from 'react';
import { useCheckpoints, extractCoordinates } from '@/hooks/useCheckpoints';

/**
 * Component that displays all checkpoint coordinates from the blockchain
 * This demonstrates how to query all checkpoints and extract their lat/lng coordinates
 */
export default function CheckpointsList() {
  const { checkpoints, loading, error, refetch } = useCheckpoints();

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading checkpoints from blockchain...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-red-800 font-medium">Error loading checkpoints</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={refetch}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const coordinates = extractCoordinates(checkpoints);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Checkpoint Coordinates ({coordinates.length} found)
        </h2>
        <button
          onClick={refetch}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {coordinates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No checkpoints found on the blockchain.</p>
          <p className="text-sm mt-1">Create some checkpoints using the admin panel.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coordinates.map((coord, index) => (
            <div key={coord.id} className="p-3 bg-gray-50 rounded border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{coord.label}</h3>
                  <p className="text-sm text-gray-600 font-mono">
                    {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                  </p>
                </div>
                <span className="text-xs text-gray-500">#{index + 1}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                ID: {coord.id.slice(0, 8)}...{coord.id.slice(-8)}
              </p>
            </div>
          ))}
        </div>
      )}

      {coordinates.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Coordinates Array Output:</h4>
          <pre className="text-xs text-blue-700 bg-blue-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(coordinates, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Hook that returns just the coordinates array - useful for map integration
 * @returns Array of {id, lat, lng, label} objects
 */
export function useCheckpointCoordinates() {
  const { checkpoints, loading, error, refetch } = useCheckpoints();

  return {
    coordinates: extractCoordinates(checkpoints),
    loading,
    error,
    refetch
  };
}