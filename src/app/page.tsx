'use client';

import WebGLMapOverlay from "@/components/WebGLMapOverlay";

export default function Home() {
  return (
    <div className="font-sans min-h-screen bg-gray-50">
      {/* Mobile-optimized header */}
      <header className="bg-white shadow-sm px-4 py-6 md:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4 text-gray-900">
            Suimming WebGL Map
          </h1>
          <p className="text-sm md:text-lg text-gray-600">
            Interactive maps with Three.js WebGL overlay
          </p>
        </div>
      </header>

      {/* Full-height map container for mobile */}
      <div className="relative">
        <div className="h-[60vh] md:h-96 mx-4 md:mx-8 mb-4 md:mb-8 border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white">
          <WebGLMapOverlay />
          {/* <TestClient /> */}
        </div>

        {/* Mobile zoom controls */}
        <div className="absolute top-4 right-8 md:hidden flex flex-col space-y-2 z-10">
          <button className="bg-white shadow-lg rounded-lg p-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button className="bg-white shadow-lg rounded-lg p-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible setup instructions for mobile */}
      <div className="mx-4 md:mx-8 max-w-6xl md:mx-auto">

        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg">
          <details className="md:open">
            <summary className="text-lg md:text-2xl font-semibold mb-4 cursor-pointer md:cursor-default flex items-center">
              <span>Setup Instructions</span>
              <svg className="w-5 h-5 ml-2 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">1</span>
                <div className="min-w-0 flex-1">
                  <strong>Install dependencies:</strong>
                  <code className="block bg-gray-100 p-2 mt-1 rounded text-xs break-all">
                    npm install three @googlemaps/three @types/three
                  </code>
                </div>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">2</span>
                <div className="min-w-0 flex-1">
                  <strong>Add your Google Maps API key to .env.local:</strong>
                  <code className="block bg-gray-100 p-2 mt-1 rounded text-xs break-all">
                    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
                  </code>
                </div>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">3</span>
                <div className="min-w-0 flex-1">
                  <strong>Ensure your API key has the following APIs enabled:</strong>
                  <ul className="list-disc list-inside mt-1 text-xs text-gray-600 space-y-1">
                    <li>Maps JavaScript API</li>
                    <li>Maps WebGL API (beta)</li>
                  </ul>
                </div>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">4</span>
                <div className="min-w-0 flex-1">
                  <strong>Restart the development server:</strong>
                  <code className="block bg-gray-100 p-2 mt-1 rounded text-xs break-all">
                    pnpm dev
                  </code>
                </div>
              </li>
            </ol>
          </details>

          {/* PWA-specific info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">📱 Mobile App Features</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Install as app on your home screen</li>
              <li>• Works offline with basic functionality</li>
              <li>• Touch-optimized map interactions</li>
              <li>• Location services integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
