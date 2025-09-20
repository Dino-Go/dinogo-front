# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Use these commands in the `suimming-front/` directory:

```bash
# Development server
pnpm dev      # Start development server (localhost:3000)

# Build and deployment
pnpm build    # Build production application
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

## Architecture Overview

Suimming is a location-based NFT collection game built on Sui blockchain. Players collect letters at physical locations and mint Sentence NFTs.

### Core Technologies
- **Next.js 15** with App Router - React framework
- **Sui Blockchain** - Smart contracts and wallet integration
- **Google Maps + Three.js** - Interactive 3D map with WebGL overlays
- **PWA** - Mobile-optimized progressive web app

### Key Directories
```
suimming-front/
├── src/app/                    # Next.js App Router pages
│   ├── components/            # Reusable React components
│   ├── map/                   # Interactive map page
│   └── layout.tsx             # Root layout with PWA config
├── src/web3/                  # Blockchain integration clients
├── src/utils/                 # Utility functions (geo, user profile)
├── src/hooks/                 # React hooks
└── src/types/                 # TypeScript definitions
```

## Blockchain Integration

### Environment Variables Required
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=        # Google Maps API key
NEXT_PUBLIC_ENOKI_API_KEY=              # Sui zkLogin authentication
NEXT_PUBLIC_GOOGLE_CLIENT_ID=           # Google OAuth for zkLogin
NEXT_PUBLIC_SUIMMING_PACKAGE_ID=        # Deployed Move contract package
NEXT_PUBLIC_UPGRADE_CAP_ID=             # Contract upgrade capability
NEXT_PUBLIC_DEPLOYMENT_TX=              # Contract deployment transaction
```

### Move Contract Integration
The frontend integrates with three main Move modules:
- **user**: Profile creation and letter inventory management
- **checkpoint**: Location-based letter collection and NFT display
- **nft**: Sentence NFT minting and transfer

Transaction pattern:
```tsx
const tx = new Transaction();
tx.moveCall({
  target: `${packageId}::module::function`,
  arguments: [/* transaction args */],
});
await signAndExecuteTransaction({ transaction: tx });
```

## Key Components

### WebGLMapOverlay (`src/app/components/WebGLMapOverlay.tsx`)
Main interactive map component combining Google Maps with Three.js WebGL overlays.

**Critical implementation details:**
- Uses `ThreeJSOverlayView` with required `altitude: 0` property
- GLTF models require specific transformations: `scale.set(30, 30, 30)` and `up = new THREE.Vector3(0, 0, 1)`
- Frame rate limiting for mobile performance
- Geolocation permissions and continuous tracking
- **Geofencing system**: Built-in proximity detection with configurable radius (`GEOFENCE_RADIUS_METERS = 50`)
- **Navigation mode**: Auto-follow user with bearing calculation for directional movement

### Web3 Clients (`src/web3/`)
Optimized TypeScript clients for Mysten Labs SDKs:
- **KioskClient**: NFT marketplace functionality
- **WalrusClient**: Decentralized file storage (direct HTTP API)
- **SealClient**: Secrets management with threshold encryption

## Development Patterns

### Code Conventions
- Use absolute imports: `@/app/components/` not `./components/`
- TypeScript strict mode - all files must have proper types
- Follow existing component patterns before creating new ones
- Check neighboring files for framework/library usage patterns

### Error Handling
```tsx
const [error, setError] = useState<string | null>(null);
try {
  await blockchainCall();
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

### Mobile Optimization
- Touch-friendly gesture handling with `gestureHandling: "greedy"`
- Location services integration
- PWA manifest in `/public/manifest.json`
- Frame rate limiting for WebGL performance

## Common Issues

### Google Maps Integration
- Verify API key is set and has proper restrictions
- Ensure HTTPS for production (required for geolocation)
- Custom map style ID: `"15431d2b469f209e"`

### Three.js Models
- GLTF files must be in `/public/` directory
- Models require specific transformations for map integration
- Always set `altitude: 0` in anchor position

### Wallet Connection
- Supports both standard Sui wallets and zkLogin (Google OAuth)
- Clear browser cache/localStorage for connection issues
- Uses testnet by default for development

## Development Workflow

1. Check existing patterns in similar components
2. Verify required dependencies in package.json
3. Use environment variables for all external API keys
4. Test wallet connections and blockchain interactions on testnet
5. Verify mobile responsiveness and PWA functionality
6. Run `pnpm lint` and `pnpm build` before commits

## Testing Integration Points
- Wallet connection with different wallet types
- Map loading across devices/browsers
- Blockchain calls on testnet before mainnet
- Geolocation permission flows
- PWA installation and offline functionality