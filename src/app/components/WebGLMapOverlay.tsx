'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { ThreeJSOverlayView } from "@googlemaps/three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface WebGLMapOverlayProps {
	className?: string;
}

// Global variables similar to trimet.js
let loader: GLTFLoader;
let map: google.maps.Map;
let overlay: ThreeJSOverlayView;

export default function WebGLMapOverlay({ className }: WebGLMapOverlayProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
	const [mounted, setMounted] = useState(false);

	// Wallet functionality
	const currentAccount = useCurrentAccount();
	const { mutate: disconnect } = useDisconnectWallet();
	const router = useRouter();

	const handleDisconnect = () => {
		disconnect();
		router.push('/');
	};

	const formatAddress = (address: string) => {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	useEffect(() => {
		setMounted(true);
	}, []);

	// Get user location first
	useEffect(() => {
		if (!mounted) return;

		const getUserLocation = async () => {
			try {
				if (navigator.geolocation && locationPermission === 'prompt') {
					const position = await new Promise<GeolocationPosition>((resolve, reject) => {
						navigator.geolocation.getCurrentPosition(resolve, reject, {
							enableHighAccuracy: true,
							timeout: 10000,
							maximumAge: 60000,
						});
					});

					setUserLocation({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					});
					setLocationPermission('granted');
				}
			} catch (error) {
				console.log('Geolocation error:', error);
				setLocationPermission('denied');
			}
		};

		getUserLocation();
	}, [mounted, locationPermission]);

	// Initialize map when location is ready
	useEffect(() => {
		if (!mounted || locationPermission === 'prompt') return;

		const initMap = async () => {
			if (!mapRef.current) return;

			// Load Google Maps API if not loaded
			if (!window.google) {
				const script = document.createElement('script');
				script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry&v=beta&loading=async`;
				script.async = true;
				script.defer = true;
				script.onload = () => setTimeout(createMap, 100);
				document.head.appendChild(script);
			} else {
				createMap();
			}
		};

		const createMap = async () => {
			if (!mapRef.current) return;

			// Use user location or default center
			const center = userLocation || { lat: 35.6594945, lng: 139.6999859 };
			const centerWithAltitude = { ...center, altitude: 0 };

			// Map options similar to trimet.js
			const mapOptions = {
				tilt: 30,
				zoom: userLocation ? 16 : 18,
				heading: 0,
				center,
				mapId: "15431d2b469f209e",
				disableDefaultUI: true,
				gestureHandling: "greedy",
			};

			// Create map
			map = new google.maps.Map(mapRef.current, mapOptions);

			// Create overlay similar to trimet.js
			overlay = new ThreeJSOverlayView({
				map,
				anchor: centerWithAltitude,
				scene: new THREE.Scene(),
				THREE,
			});

			// Add ambient light like trimet.js
			const ambientLight = new THREE.AmbientLight(0xFFFFFF);
			ambientLight.intensity = 0.5;
			(overlay as any).scene.add(ambientLight);

			// Initialize GLTF loader
			loader = new GLTFLoader();

			// Load pin.gltf similar to trimet.js bus loading
			loader.load(
				'/labubu.glb',
				gltf => {
					// Apply transformations similar to trimet.js
					gltf.scene.scale.set(30, 30, 30);
					gltf.scene.up = new THREE.Vector3(0, 0, 1); // Important from trimet.js

					// Apply rotations to all children like trimet.js does
					if (gltf.scene.children.length > 0) {
						gltf.scene.children.forEach(child => {
							child.rotation.x = Math.PI / 2;
							child.position.z = 1;
						});
					}

					// Add to overlay scene
					(overlay as any).scene.add(gltf.scene);
				},
				() => {
					// Loading progress
				},
				() => {
					// Fallback: Create a simple red object like Google's example
					const geometry = new THREE.BoxGeometry(50, 50, 50);
					const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
					const cube = new THREE.Mesh(geometry, material);
					cube.position.set(0, 25, 0);
					(overlay as any).scene.add(cube);
				}
			);
		};

		initMap();
	}, [mounted, locationPermission, userLocation]);

	const requestLocation = async () => {
		try {
			const position = await new Promise<GeolocationPosition>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0,
				});
			});

			const location = {
				lat: position.coords.latitude,
				lng: position.coords.longitude,
			};

			setUserLocation(location);
			setLocationPermission('granted');

			// Center map on user location
			if (map) {
				map.setCenter(location);
				map.setZoom(16);
			}
		} catch (error) {
			console.error('Geolocation error:', error);
			setLocationPermission('denied');
		}
	};

	if (!mounted || locationPermission === 'prompt') {
		return (
			<div className="w-full h-full flex items-center justify-center bg-gray-100">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-2 text-gray-600">
						{locationPermission === 'prompt' ? 'Detecting your location...' : 'Loading map...'}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative w-full h-full">
			<div
				ref={mapRef}
				className={`w-full h-full ${className || ''}`}
				style={{ minHeight: '400px' }}
			/>

			{/* Location request button for mobile */}
			{locationPermission === 'denied' && (
				<button
					onClick={requestLocation}
					className="absolute bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors z-10 md:hidden"
					title="Get current location"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>
			)}

			{/* Wallet status and disconnect button - Top Right */}
			{currentAccount && (
				<div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
					{/* Wallet status */}
					<div className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg flex items-center gap-2">
						<span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></span>
						<span className="font-mono">{formatAddress(currentAccount.address)}</span>
					</div>

					{/* Disconnect button */}
					<button
						onClick={handleDisconnect}
						className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg transition-colors duration-200 flex items-center gap-1"
						title="Disconnect wallet and return to home"
					>
						<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						Disconnect
					</button>
				</div>
			)}

			{/* Location status indicator - Top Left */}
			{userLocation && (
				<div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg z-10">
					📍 Location found
				</div>
			)}

			{locationPermission === 'denied' && (
				<div className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg z-10">
					📍 Location unavailable
				</div>
			)}
		</div>
	);
}