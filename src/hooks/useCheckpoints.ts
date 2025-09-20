'use client';

import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { useWalrusClient } from '@/web3/walrusClient';

export interface CheckpointCoordinates {
  id: string;
  lat: number;
  lng: number;
  label: string;
  active: boolean;
  metaWalrusId: string;
  sealRef: string;
}

export interface UseCheckpointsResult {
  checkpoints: CheckpointCoordinates[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to query all checkpoints from the blockchain and extract their coordinates
 * Note: Current implementation uses placeholder metadata. In production, this would
 * fetch actual metadata from Walrus using the meta_walrus_id from each checkpoint.
 */
export function useCheckpoints(): UseCheckpointsResult {
  const [checkpoints, setCheckpoints] = useState<CheckpointCoordinates[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const suiClient = useSuiClient();
  const { downloadJSON, blobExists } = useWalrusClient(suiClient, 'testnet');

  const fetchCheckpoints = async () => {
    if (!suiClient) {
      setError('Sui client not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Query all Checkpoint objects from the chain
      // Note: In production, you might want to paginate this query for large numbers of checkpoints
      const checkpointObjects = await suiClient.queryEvents({
        query: {
          MoveEventType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::checkpoint::CheckpointCreated`
        }
      });

      // Get the actual checkpoint objects using the addresses from events
      const checkpointObjectsData = await Promise.all(
        checkpointObjects.data.map(async (event) => {
          const eventData = event.parsedJson as any;
          const checkpointAddress = eventData.checkpoint;

          try {
            return await suiClient.getObject({
              id: checkpointAddress,
              options: {
                showContent: true,
                showType: true,
                showOwner: true
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch checkpoint ${checkpointAddress}:`, error);
            return null;
          }
        })
      );

      // Filter out failed fetches and create a data structure similar to getOwnedObjects
      const validCheckpointObjects = checkpointObjectsData.filter(obj => obj !== null && obj.data);
      const checkpointObjectsResult = { data: validCheckpointObjects.map(obj => obj!) };

      const coordinatesPromises = checkpointObjectsResult.data.map(async (obj) => {
        if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
          return null;
        }

        const fields = (obj.data.content as any).fields;

        // Extract basic checkpoint info
        const checkpointInfo = {
          id: obj.data.objectId,
          label: fields.label || 'Unknown Checkpoint',
          active: fields.active || false,
          metaWalrusId: fields.meta_walrus_id || '',
          sealRef: fields.seal_ref || ''
        };

        // Fetch actual metadata from Walrus using meta_walrus_id
        try {
          // Check if this is a real Walrus blob ID or old placeholder
          if (fields.meta_walrus_id && fields.meta_walrus_id.startsWith('metadata_')) {
            // This is an old placeholder - return mock coordinates for backward compatibility
            console.warn(`Checkpoint ${checkpointInfo.id} uses placeholder metadata. Real coordinates unavailable.`);
            return {
              ...checkpointInfo,
              lat: 37.7749 + (Math.random() - 0.5) * 0.01, // Random coordinates around SF
              lng: -122.4194 + (Math.random() - 0.5) * 0.01
            };
          }

          // Check if blob exists on Walrus before attempting download
          const exists = await blobExists(fields.meta_walrus_id);
          if (!exists) {
            console.warn(`Walrus blob ${fields.meta_walrus_id} does not exist for checkpoint ${checkpointInfo.id}`);
            return null;
          }

          // Fetch metadata from Walrus
          const metadata = await downloadJSON<{
            latitude: number;
            longitude: number;
            description?: string;
            image_url?: string;
            type?: string;
            version?: string;
          }>(fields.meta_walrus_id);

          // Validate metadata structure
          if (!metadata || typeof metadata.latitude !== 'number' || typeof metadata.longitude !== 'number') {
            console.error(`Invalid metadata structure for checkpoint ${checkpointInfo.id}:`, metadata);
            return null;
          }

          return {
            ...checkpointInfo,
            lat: metadata.latitude,
            lng: metadata.longitude
          };

        } catch (walrusError) {
          console.error(`Failed to fetch metadata for checkpoint ${checkpointInfo.id}:`, walrusError);
          return null;
        }
      });

      const results = await Promise.all(coordinatesPromises);
      const validCheckpoints = results.filter((checkpoint): checkpoint is CheckpointCoordinates =>
        checkpoint !== null
      );

      setCheckpoints(validCheckpoints);
    } catch (err) {
      console.error('Error fetching checkpoints:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch checkpoints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckpoints();
  }, [suiClient]);

  return {
    checkpoints,
    loading,
    error,
    refetch: fetchCheckpoints
  };
}

/**
 * Utility function to extract just the coordinates from checkpoints
 * @param checkpoints Array of checkpoint data
 * @returns Array of coordinate objects with id, lat, lng
 */
export function extractCoordinates(checkpoints: CheckpointCoordinates[]): Array<{id: string, lat: number, lng: number, label: string}> {
  return checkpoints.map(checkpoint => ({
    id: checkpoint.id,
    lat: checkpoint.lat,
    lng: checkpoint.lng,
    label: checkpoint.label
  }));
}

