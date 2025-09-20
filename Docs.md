# Suimming Frontend Developer Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Development Setup](#development-setup)
5. [Environment Variables](#environment-variables)
6. [Core Components](#core-components)
7. [Sui Blockchain Integration](#sui-blockchain-integration)
8. [Move Contracts Integration](#move-contracts-integration)
9. [Google Maps & WebGL Integration](#google-maps--webgl-integration)
10. [PWA Features](#pwa-features)
11. [Development Workflow](#development-workflow)
12. [Common Patterns](#common-patterns)
13. [Troubleshooting](#troubleshooting)
14. [Deployment](#deployment)

## Project Overview

Suimming is a location-based collection game built on Sui where players collect letters at physical locations and mint Sentence NFTs. The frontend is a Next.js PWA with interactive map features, Three.js WebGL overlays, and comprehensive Sui blockchain integration.

### Game Flow
1. **Authentication**: Users connect via Sui wallet or zkLogin
2. **Location Discovery**: Interactive map displays checkpoint locations
3. **Letter Collection**: Visit checkpoints to collect random letters
4. **NFT Creation**: Compose sentences using collected letters to mint NFTs
5. **Social Features**: Boast sentences at checkpoints for discovery

## Architecture Overview

```
suimming-front/
├── src/app/                    # Next.js App Router
│   ├── components/            # Reusable components
│   │   ├── ConnectWallet.tsx   # Wallet connection UI
│   │   ├── Providers.tsx       # App-wide providers
│   │   ├── RegisterEnokiWallets.tsx # zkLogin setup
│   │   └── WebGLMapOverlay.tsx # Main map component
│   ├── map/                   # Map page route
│   ├── layout.tsx             # Root layout with PWA config
│   ├── page.tsx               # Home/landing page
│   └── globals.css            # Global styles
├── public/                    # Static assets
│   ├── manifest.json          # PWA manifest
│   ├── pin.gltf              # 3D pin model
│   └── icons/                # PWA icons
├── types/                     # TypeScript definitions
└── package.json              # Dependencies and scripts
```

## Tech Stack

### Core Framework
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling framework

### Blockchain Integration
- **@mysten/dapp-kit 0.18.0** - Sui dApp development kit
- **@mysten/sui.js 0.54.1** - Sui JavaScript SDK
- **@mysten/enoki 0.12.0** - zkLogin authentication
- **@mysten/walrus 0.7.0** - Decentralized storage

### 3D Graphics & Maps
- **Three.js 0.180.0** - 3D graphics library
- **@googlemaps/three 4.0.13** - Google Maps Three.js integration
- **Google Maps API** - Map services

### State Management
- **@tanstack/react-query 5.87.4** - Server state management

## Development Setup

### Prerequisites
- Node.js 18+
- pnpm package manager
- Google Maps API key
- Sui wallet for testing

### Installation

```bash
# Clone repository
git clone <repository-url>
cd suimming-front

# Install dependencies
pnpm install

# Set up environment variables (see below)
cp .env.example .env.local

# Start development server
pnpm dev
```

### Development Commands

```bash
pnpm dev      # Start development server (localhost:3000)
pnpm build    # Build production application
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

## Environment Variables

### Required Variables

```env
# Google Maps Integration
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Sui zkLogin Authentication
NEXT_PUBLIC_ENOKI_API_KEY=your_enoki_api_key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Deployed Move Contracts (automatically set after deployment)
NEXT_PUBLIC_SUIMMING_PACKAGE_ID=0xbfb79081f4722d4c9535731bf27ef96229e9aff6284bac3fda7922506873935b
NEXT_PUBLIC_UPGRADE_CAP_ID=0xaf3a5fa748fb27eba8e53f29004953521fa2d168a30c8b9c8bac00589c62e0d0
NEXT_PUBLIC_DEPLOYMENT_TX=BGfXdJscZ312XiM2wt3czgmTZ4d35DArarHHaA1uEhJ1
```

### API Key Setup
1. **Google Maps API**: Enable Maps JavaScript API and restrict to your domain
2. **Enoki API**: Register at Mysten Labs for zkLogin functionality
3. **Google OAuth**: Set up OAuth 2.0 credentials for zkLogin

## Core Components

### Providers (`/app/components/Providers.tsx`)
App-wide context providers managing blockchain connectivity.

```tsx
// Key features:
- SuiClientProvider: Connects to Sui testnet/mainnet
- WalletProvider: Manages wallet connections
- QueryClientProvider: React Query setup
- RegisterEnokiWallets: zkLogin wallet registration
```

### WebGLMapOverlay (`/app/components/WebGLMapOverlay.tsx`)
Main interactive map component with 3D overlays.

**Key Features:**
- Google Maps integration with custom 3D styling
- Three.js WebGL overlay using ThreeJSOverlayView
- Geolocation services for user positioning
- GLTF model loading for checkpoint pins
- Mobile-optimized touch interactions
- Wallet connection status display

**Implementation Pattern:**
```tsx
// 1. Location detection
useEffect(() => {
  navigator.geolocation.getCurrentPosition(/* ... */);
}, []);

// 2. Map initialization
const createMap = () => {
  map = new google.maps.Map(mapRef.current, mapOptions);
  overlay = new ThreeJSOverlayView({
    map,
    anchor: { lat, lng, altitude: 0 },
    scene: new THREE.Scene(),
    THREE,
  });
};

// 3. 3D model loading
loader.load('/pin.gltf', gltf => {
  gltf.scene.scale.set(30, 30, 30);
  overlay.scene.add(gltf.scene);
});
```

### ConnectWallet (`/app/components/ConnectWallet.tsx`)
Wallet connection interface supporting multiple wallet types.

### RegisterEnokiWallets (`/app/components/RegisterEnokiWallets.tsx`)
zkLogin wallet registration for social authentication.

## Sui Blockchain Integration

### Network Configuration
```tsx
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});
```

### Wallet Integration Hooks
```tsx
import {
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClient,
  useSignTransaction
} from '@mysten/dapp-kit';

// Current connected account
const currentAccount = useCurrentAccount();

// Disconnect functionality
const { mutate: disconnect } = useDisconnectWallet();

// Sui client for blockchain interactions
const client = useSuiClient();
```

### Transaction Patterns
```tsx
// Example transaction execution
const executeTransaction = async () => {
  const tx = new Transaction();

  // Add move calls to transaction
  tx.moveCall({
    target: `${packageId}::module::function`,
    arguments: [/* ... */],
  });

  // Sign and execute
  const result = await signAndExecuteTransaction({
    transaction: tx,
  });
};
```

## Move Contracts Integration

The frontend integrates with three main Move modules:

### 1. User Module (`suimming_move::user`)

**Key Functions:**
- `create_profile()` - Create user profile
- `update_profile()` - Update display name and bio
- `append_letters()` - Add letters to inventory (package-only)
- `consume_letters()` - Use letters for NFT minting (package-only)

**Integration Pattern:**
```tsx
// Create user profile
const createProfile = async () => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::user::create_profile`,
    arguments: [],
  });
  await signAndExecuteTransaction({ transaction: tx });
};
```

### 2. Checkpoint Module (`suimming_move::checkpoint`)

**Key Functions:**
- `claim_letters()` - Collect random letters at checkpoints
- `boast_here()` - Display sentence NFT at checkpoint
- `unboast_here()` - Remove sentence display

**Integration Pattern:**
```tsx
// Claim letters at checkpoint
const claimLetters = async (checkpointId: string, userProfileId: string) => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::checkpoint::claim_letters`,
    arguments: [
      tx.object(checkpointId),
      tx.object(userProfileId),
      tx.object('0x8'), // Random object
    ],
  });
  await signAndExecuteTransaction({ transaction: tx });
};
```

### 3. NFT Module (`suimming_move::nft`)

**Key Functions:**
- `mint_sentence_from_profile()` - Create Sentence NFT from letters
- `transfer_sentence()` - Transfer NFT to another address

**Integration Pattern:**
```tsx
// Mint sentence NFT
const mintSentence = async (
  userProfileId: string,
  consume: string,
  text: string,
  walrusCid: string
) => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::nft::mint_sentence_from_profile`,
    arguments: [
      tx.object(userProfileId),
      tx.pure.string(consume),
      tx.pure.string(text),
      tx.pure.string(walrusCid),
    ],
  });
  await signAndExecuteTransaction({ transaction: tx });
};
```

## Google Maps & WebGL Integration

### Map Configuration
```tsx
const mapOptions = {
  tilt: 30,            // 3D tilt angle
  zoom: 16,            // Zoom level
  heading: 0,          // Rotation
  center: { lat, lng }, // Map center
  mapId: "15431d2b469f209e", // Custom map style
  disableDefaultUI: true,     // Clean interface
  gestureHandling: "greedy",  // Mobile-friendly gestures
};
```

### ThreeJSOverlayView Setup
```tsx
// Create overlay with required properties
overlay = new ThreeJSOverlayView({
  map,                        // Google Maps instance
  anchor: { lat, lng, altitude: 0 }, // Required altitude property
  scene: new THREE.Scene(),   // Three.js scene
  THREE,                      // Three.js library reference
});

// Add lighting
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
overlay.scene.add(ambientLight);
```

### GLTF Model Loading
```tsx
const loader = new GLTFLoader();
loader.load('/pin.gltf', gltf => {
  // Apply transformations (critical for proper display)
  gltf.scene.scale.set(30, 30, 30);
  gltf.scene.up = new THREE.Vector3(0, 0, 1); // Required for map integration

  // Apply rotations to children
  gltf.scene.children.forEach(child => {
    child.rotation.x = Math.PI;  // Flip model
    child.position.z = 5;        // Elevate above ground
  });

  overlay.scene.add(gltf.scene);
});
```

## PWA Features

### Manifest Configuration (`/public/manifest.json`)
```json
{
  "name": "Suimming",
  "short_name": "Suimming",
  "description": "Location-based letter collection game",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [/* ... */]
}
```

### Service Worker
- Automatic registration via Next.js PWA features
- Offline capability for core functionality
- Background sync for blockchain interactions

### Mobile Optimization
- Touch-friendly gesture handling
- Location services integration
- Responsive design with mobile-first approach
- Frame rate limiting for performance

## Development Workflow

### Code Organization Rules
- **Use absolute imports**: `@/app/components/` instead of `./components/`
- **Follow existing patterns**: Check similar components before creating new ones
- **TypeScript strict mode**: All files must have proper type definitions
- **Component structure**: Keep components focused and reusable

### Git Workflow
```bash
# Development cycle
git checkout -b feature/your-feature
# Make changes
pnpm lint          # Check code quality
pnpm build         # Verify build works
git commit -m "feat: your feature"
git push origin feature/your-feature
```

### Testing Integration Points
1. **Wallet Connection**: Test with different wallet types
2. **Map Loading**: Verify across different devices/browsers
3. **Blockchain Calls**: Test with testnet before mainnet
4. **Geolocation**: Test permission flows

## Common Patterns

### Error Handling
```tsx
const [error, setError] = useState<string | null>(null);

try {
  await blockchainCall();
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

### Loading States
```tsx
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await action();
  } finally {
    setLoading(false);
  }
};
```

### Conditional Rendering
```tsx
// Wait for wallet connection
if (!currentAccount) {
  return <ConnectWallet />;
}

// Wait for location permission
if (locationPermission === 'prompt') {
  return <LoadingScreen />;
}
```

## Troubleshooting

### Common Issues

**1. Google Maps Not Loading**
- Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
- Check API key restrictions and enabled services
- Ensure HTTPS for production deployment

**2. Three.js Models Not Appearing**
- Verify GLTF file is in `/public/` directory
- Check model transformations (scale, rotation, position)
- Ensure `altitude` property is set in anchor position

**3. Wallet Connection Issues**
- Clear browser cache and localStorage
- Check network configuration (testnet vs mainnet)
- Verify Enoki API key for zkLogin

**4. Build Errors on Deployment**
- Use absolute imports (`@/`) instead of relative imports
- Check for case-sensitive import paths
- Verify all environment variables are set

### Performance Optimization
- Limit WebGL frame rate on mobile devices
- Use React.memo for expensive components
- Implement proper cleanup in useEffect hooks
- Optimize GLTF models for web delivery

## Deployment

### Vercel Deployment
1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables Checklist
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] `NEXT_PUBLIC_ENOKI_API_KEY`
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] `NEXT_PUBLIC_SUIMMING_PACKAGE_ID`
- [ ] `NEXT_PUBLIC_UPGRADE_CAP_ID`
- [ ] `NEXT_PUBLIC_DEPLOYMENT_TX`

### Build Verification
```bash
pnpm build  # Verify successful build
pnpm start  # Test production build locally
```

### Post-Deployment Testing
1. Verify PWA installation works
2. Test wallet connections on mobile
3. Check map loading and 3D models
4. Validate blockchain interactions

---

## Additional Resources

- [Sui dApp Kit Documentation](https://sdk.mystenlabs.com/dapp-kit)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Three.js Documentation](https://threejs.org/docs/)
- [Next.js App Router](https://nextjs.org/docs/app)

For questions or issues, refer to the project's CLAUDE.md file or contact the development team.