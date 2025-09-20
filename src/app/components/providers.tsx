'use client';

import { SuiClientProvider, createNetworkConfig, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { PropsWithChildren, useMemo, useState } from 'react';
import RegisterEnokiWallets from '@/app/components/RegisterEnokiWallets';
import { ToastProvider } from '@/app/components/Toaster';

const { networkConfig } = createNetworkConfig({
	testnet: { url: getFullnodeUrl('testnet') },
	mainnet: { url: getFullnodeUrl('mainnet') },
});

export function Providers({ children }: PropsWithChildren) {
    const [queryClient] = useState(() => new QueryClient());
    const networks = useMemo(() => networkConfig, []);

    return (
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networks} network="testnet">
                <RegisterEnokiWallets />
                <WalletProvider autoConnect>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    );
}