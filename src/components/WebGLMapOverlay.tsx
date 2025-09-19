'use client';

import dynamic from 'next/dynamic';

interface WebGLMapOverlayProps {
  className?: string;
}

// Simple dynamic import with no SSR
const DynamicMapComponent = dynamic(
  () => import('./WebGLMapOverlaySimple'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export default function WebGLMapOverlay(props: WebGLMapOverlayProps) {
  return <DynamicMapComponent {...props} />;
}