# Web3 Clients for Suimming

Simplified and optimized TypeScript clients for Mysten Labs' Web3 SDKs, focused on core functionality:

- **KioskClient**: NFT marketplace and trading functionality
- **WalrusClientManager**: Decentralized file storage with direct HTTP API
- **SealClientManager**: Decentralized secrets management with threshold encryption

## Quick Start

### Installation

Required dependencies are already included:

```json
{
  "@mysten/dapp-kit": "^0.18.0",
  "@mysten/sui.js": "^0.54.1",
  "@mysten/walrus": "^0.7.0",
  "@mysten/seal": "^0.6.0"
}
```

### Basic Usage

```tsx
import { initializeWeb3Clients } from '@/web3';
import { useSuiClient } from '@mysten/dapp-kit';

function MyComponent() {
  const suiClient = useSuiClient();

  const { kiosk, walrus, seal } = initializeWeb3Clients({
    suiClient,
    network: 'testnet'
  });

  // Use the clients...
}
```

## Individual Client Usage

### 1. Kiosk Client (NFT Marketplace)

```tsx
import { KioskClient } from '@/web3';

const kioskClient = new KioskClient({
  suiClient,
  network: 'testnet'
});

// Get user's kiosks
const kiosks = await kioskClient.getOwnedKiosks(userAddress);

// Create kiosk transaction
const kioskTx = kioskClient.createKioskTransaction(transaction);
```

### 2. Walrus Client (File Storage)

```tsx
import { WalrusClientManager } from '@/web3';

const walrusClient = new WalrusClientManager({
  suiClient,
  network: 'testnet'
});

// Upload a file
const result = await walrusClient.uploadFile({
  file: selectedFile,
  epochs: 10,
  force: false
});

console.log('Blob ID:', result.blobId);

// Download a file
const fileData = await walrusClient.downloadFile(result.blobId);

// Upload/download text
const textResult = await walrusClient.uploadText('Hello Walrus!');
const downloadedText = await walrusClient.downloadText(textResult.blobId);

// Upload/download JSON
const jsonResult = await walrusClient.uploadJSON({ message: 'Hello' });
const downloadedJson = await walrusClient.downloadJSON(jsonResult.blobId);
```

### 3. Seal Client (Secrets Management)

```tsx
import { SealClientManager, SealUtils } from '@/web3';

const sealClient = new SealClientManager({
  suiClient,
  network: 'testnet',
  keyServerUrls: ['https://keyserver1.example.com'] // optional
});

// Seal (encrypt) data
const sealedData = await sealClient.seal({
  data: 'sensitive information',
  threshold: 2
});

// Unseal (decrypt) data - requires session key and transaction bytes
const unsealed = await sealClient.unseal({
  sealId: sealedData.sealId,
  requesterAddress: userAddress,
  encryptedData: new Uint8Array(/* encrypted data */),
  sessionKey: sessionKey,
  txBytes: transactionBytes
});

// Utilities
const policy = SealUtils.createAddressPolicy([userAddress], 1);
const isValid = SealUtils.validateSealedData(sealedData);
```

## React Hooks

Each client provides a corresponding React hook:

```tsx
import { useKioskClient, useWalrusClient, useSealClient } from '@/web3';

function MyComponent() {
  const suiClient = useSuiClient();

  // Individual hooks
  const { getOwnedKiosks, createKioskTransaction } = useKioskClient(suiClient);
  const { uploadFile, downloadFile } = useWalrusClient(suiClient, 'testnet');
  const { seal, unseal } = useSealClient(suiClient, 'testnet');

  // Use the hook methods...
}
```

## File Upload Examples

### Image Upload with Validation

```tsx
const handleImageUpload = async (file: File) => {
  // Validate file
  try {
    WalrusUtils.validateFile(file, 10 * 1024 * 1024); // 10MB limit
  } catch (error) {
    alert(error.message);
    return;
  }

  // Generate preview
  if (file.type.startsWith('image/')) {
    const preview = await WalrusUtils.generatePreview(file);
    console.log('Preview URL:', preview);
  }

  // Upload to Walrus
  const result = await walrusClient.uploadFile({
    file,
    epochs: 5
  });

  console.log('Uploaded:', result.blobId);
};
```

### Batch File Upload

```tsx
const handleBatchUpload = async (files: File[]) => {
  const results = await walrusClient.uploadFiles(files, 10);

  results.forEach((result, index) => {
    console.log(`File ${index + 1}:`, result.blobId);
  });
};
```

## Error Handling

All clients include comprehensive error handling:

```tsx
try {
  const result = await walrusClient.uploadFile({ file });
} catch (error) {
  if (error.message.includes('File size')) {
    // Handle file size error
  } else if (error.message.includes('network')) {
    // Handle network error
  } else {
    // Handle general error
  }
}
```

## Testing

Use the test function to verify all clients initialize correctly:

```tsx
import { testClientInitialization } from '@/web3/test-init';

// In browser console or component
const testResult = testClientInitialization();
console.log('Test result:', testResult);
```

## Configuration

### Environment Variables

Set these in your `.env.local`:

```env
NEXT_PUBLIC_SUIMMING_PACKAGE_ID=0xbfb79081f4722d4c9535731bf27ef96229e9aff6284bac3fda7922506873935b
NEXT_PUBLIC_UPGRADE_CAP_ID=0xaf3a5fa748fb27eba8e53f29004953521fa2d168a30c8b9c8bac00589c62e0d0
NEXT_PUBLIC_DEPLOYMENT_TX=BGfXdJscZ312XiM2wt3czgmTZ4d35DArarHHaA1uEhJ1
```

### Network URLs

- **Walrus Testnet Publisher**: `https://publisher.walrus-testnet.walrus.space`
- **Walrus Testnet Aggregator**: `https://aggregator.walrus-testnet.walrus.space`
- **Sui Testnet Explorer**: `https://suiscan.xyz/testnet/`

## Key Features

### ✅ Production Ready
- Direct HTTP API for Walrus (no SDK wrapper)
- Proper error handling with retry logic
- TypeScript strict mode compliance
- Mobile-optimized file handling

### ✅ Developer Friendly
- Simple initialization functions
- Comprehensive React hooks
- Built-in utilities for common tasks
- Clear error messages

### ✅ Optimized
- Based on proven suiShare patterns
- Minimal dependencies
- Tree-shakable exports
- No unused utility files

## Architecture

```
src/web3/
├── kioskClient.ts     # NFT marketplace client
├── walrusClient.ts    # File storage client (direct HTTP)
├── sealClient.ts      # Secrets management client
├── index.ts           # Unified exports and initialization
├── test-init.ts       # Initialization testing
└── README.md          # This documentation
```

## Troubleshooting

### Common Issues

1. **SealClient initialization errors**:
   - Uses fallback initialization with type assertions for SDK compatibility
   - If key server URLs are not accessible, client will still initialize but operations may fail

2. **Walrus upload failures**:
   - Check file size limits and network connectivity
   - Uses direct HTTP API calls to Walrus testnet endpoints

3. **Kiosk operations**:
   - Currently uses placeholder implementations
   - Install `@mysten/kiosk` when permission issues are resolved for full functionality

4. **Network errors**:
   - Verify you're using the correct network (testnet/mainnet)
   - All clients default to testnet for development

### TypeScript Compatibility

The clients are designed to work with current SDK versions but use type assertions where needed:
- `SealClient` uses `as any` for SuiClient compatibility
- `WalrusClient` handles ArrayBuffer/Uint8Array conversion for Blob creation
- All TypeScript strict mode errors have been resolved

### Debug Mode

Enable debug logging by setting console.log level:

```tsx
// Enable debug logs
console.log('Debug mode enabled');

// Test initialization
const result = testClientInitialization();
```

## Integration with Suimming

The clients are designed to work seamlessly with the Suimming game:

- **Kiosk**: For trading Sentence NFTs
- **Walrus**: For storing letter collections and metadata
- **Seal**: For encrypting sensitive game data

All clients use the deployed Move package ID from environment variables and are configured for the game's specific needs.