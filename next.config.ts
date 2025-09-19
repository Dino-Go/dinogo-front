import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore TypeScript errors for Three.js types
  },
  // experimental: {
  //   esmExternals: 'loose', // Better support for ESM modules like Three.js
  // },
};

export default nextConfig;