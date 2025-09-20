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

      // CheckpointCreated 이벤트 가져오기
      const checkpointObjects = await suiClient.queryEvents({
        query: {
          MoveEventType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::checkpoint::CheckpointCreated`
        }
      });

      // 이벤트에서 object 가져오기
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
          } catch (e) {
            console.warn(`Failed to fetch checkpoint object ${checkpointAddress}:`, e);
            return null;
          }
        })
      );

      // 유효한 오브젝트만 남기기
      const validObjs = checkpointObjectsData.filter(obj => obj !== null && obj.data);
      const checkpointObjs = validObjs.map(obj => obj!);

      // 메타데이터로부터 좌표 읽기 (placeholder 아닌 것만)
      const coordinatesPromises = checkpointObjs.map(async (obj) => {
        if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
          return null;
        }

        const fields = (obj.data.content as any).fields;

        const checkpointInfo = {
          id: obj.data.objectId,
          label: fields.label || 'Unknown Checkpoint',
          active: fields.active || false,
          metaWalrusId: fields.meta_walrus_id || '',
          sealRef: fields.seal_ref || ''
        };

        const metaId = fields.meta_walrus_id;
        // placeholder인지 체크
        if (!metaId) {
          // 메타가 없으면 무시
          // console.warn(`Checkpoint ${checkpointInfo.id} has no metaWalrusId. Skipping.`);
          return null;
        }
        if (metaId.startsWith('metadata_')) {
          // placeholder이면 무시
          // console.warn(`Checkpoint ${checkpointInfo.id} uses placeholder metadata. Skipping.`);
          return null;
        }

        // 실제 blob 존재 확인
        const exists = await blobExists(metaId);
        if (!exists) {
          // console.warn(`Walrus blob ${metaId} does not exist for checkpoint ${checkpointInfo.id}. Skipping.`);
          return null;
        }

        // metadata JSON 다운로드
        const metadata = await downloadJSON<{
          latitude: number;
          longitude: number;
          description?: string;
          image_url?: string;
          type?: string;
          version?: string;
        }>(metaId);

        if (
          !metadata ||
          typeof metadata.latitude !== 'number' ||
          typeof metadata.longitude !== 'number'
        ) {
          console.error(`Invalid metadata structure for checkpoint ${checkpointInfo.id}:`, metadata);
          return null;
        }

        return {
          ...checkpointInfo,
          lat: metadata.latitude,
          lng: metadata.longitude
        };
      });

      const results = await Promise.all(coordinatesPromises);
      // null인 항목들 제거
      const validCheckpoints = results.filter(
        (cp): cp is CheckpointCoordinates => cp !== null
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

// 좌표만 꺼내는 유틸
export function extractCoordinates(
  checkpoints: CheckpointCoordinates[]
): Array<{ id: string; lat: number; lng: number; label: string }> {
  return checkpoints.map(cp => ({
    id: cp.id,
    lat: cp.lat,
    lng: cp.lng,
    label: cp.label
  }));
}