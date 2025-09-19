import { isEnokiNetwork, registerEnokiWallets } from '@mysten/enoki';
import { useSuiClientContext } from '@mysten/dapp-kit';

import { useEffect } from 'react';

export default function RegisterEnokiWallets() {
	const { client, network } = useSuiClientContext();

	useEffect(() => {
		if (!isEnokiNetwork(network)) return;

		const { unregister } = registerEnokiWallets({
			apiKey: 'enoki_public_eadb825c5c90c588b048d22404a5a4b2',
			providers: {
				google: {
					clientId: '347337325039-9ics8t8klbs3ukov4o6u6ps5fre3t7t3.apps.googleusercontent.com',
				},
				// facebook: {
				// 	clientId: 'YOUR_FACEBOOK_CLIENT_ID',
				// },
				// twitch: {
				// 	clientId: 'YOUR_TWITCH_CLIENT_ID',
				// },
			},
			client,
			network,
		});

		return unregister;
	}, [client, network]);

	return null;
}