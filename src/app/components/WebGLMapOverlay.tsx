'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { ThreeJSOverlayView } from "@googlemaps/three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { toGoogleMapsLatLng, toThreeJSAnchor, interpolateLocation, isMobileDevice } from '@/utils/geoUtils';
import { useToast } from '@/app/components/Toaster';
import type { LocationWithAccuracy } from '@/types/location';

interface WebGLMapOverlayProps {
	className?: string;
}

// Global variables similar to trimet.js
let loader: GLTFLoader;
let map: google.maps.Map | null = null;
let overlay: ThreeJSOverlayView;
let labubuObject: THREE.Group | null = null;

export default function WebGLMapOverlay({ className }: WebGLMapOverlayProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);
	const [isMapReady, setIsMapReady] = useState(false);
	const animationFrameRef = useRef<number | null>(null);
	const targetPositionRef = useRef<LocationWithAccuracy | null>(null);
	const currentInterpolatedPosition = useRef<LocationWithAccuracy | null>(null);
	const interpolationStartTime = useRef<number>(0);
	// Mobile device detection
	const isMobile: boolean = isMobileDevice();
	const interpolationDuration = isMobile ? 3000 : 2000; // Mobile-optimized duration

	// Wallet functionality
	const currentAccount = useCurrentAccount();
	const { mutate: disconnect } = useDisconnectWallet();
	const router = useRouter();
	const { addNotification } = useToast();

	// Location tracking
	const {
		state: locationState,
		startWatching,
		stopWatching,
		requestLocation,
		getCurrentPosition,
		isFollowingEnabled,
		toggleFollowing,
		getMovementUpdate
	} = useLocationTracking({
		enableHighAccuracy: true,
		timeout: 10000,
		maximumAge: 60000,
		minDistanceThreshold: 3, // 3 meters for more responsive movement
		updateThrottle: 1500, // 1.5 seconds for smooth updates
		maxAccuracy: 50 // 50 meters max accuracy
	});

	const handleDisconnect = () => {
		disconnect();
		router.push('/');
	};

	const formatAddress = (address: string) => {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	// Smooth position interpolation for 3D object
	const interpolatePosition = useCallback((startPosition: LocationWithAccuracy, endPosition: LocationWithAccuracy, elapsed: number): LocationWithAccuracy => {
		const progress = Math.min(elapsed / interpolationDuration, 1);
		// Use easing function for smoother animation
		const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

		const interpolated = interpolateLocation(startPosition, endPosition, easedProgress);

		return {
			...endPosition,
			lat: interpolated.lat,
			lng: interpolated.lng,
			altitude: interpolated.altitude
		};
	}, []);

	// Update 3D object position smoothly
	const update3DObjectPosition = useCallback((newPosition: LocationWithAccuracy) => {
		if (!overlay || !labubuObject || !isMapReady) return;

		// Set target position for interpolation
		targetPositionRef.current = newPosition;
		interpolationStartTime.current = Date.now();

		// If this is the first position, jump immediately
		if (!currentInterpolatedPosition.current) {
			currentInterpolatedPosition.current = newPosition;
			const anchor = toThreeJSAnchor(newPosition);
			(overlay as any).anchor = anchor;
			return;
		}

		// Start animation loop for smooth movement
		const animate = () => {
			if (!targetPositionRef.current || !currentInterpolatedPosition.current) return;

			const elapsed = Date.now() - interpolationStartTime.current;
			const interpolatedPos = interpolatePosition(currentInterpolatedPosition.current, targetPositionRef.current, elapsed);

			// Update overlay anchor
			const anchor = toThreeJSAnchor(interpolatedPos);
			(overlay as any).anchor = anchor;

			// Update current position
			currentInterpolatedPosition.current = interpolatedPos;

			// Continue animation if not complete
			if (elapsed < interpolationDuration) {
				animationFrameRef.current = requestAnimationFrame(animate);
			} else {
				// Animation complete
				currentInterpolatedPosition.current = targetPositionRef.current;
				animationFrameRef.current = null;
			}
		};

		// Cancel any existing animation
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}

		// Start new animation
		animationFrameRef.current = requestAnimationFrame(animate);
	}, [isMapReady, interpolatePosition]);

	// Update map center smoothly without affecting 3D object
	const updateMapCenter = useCallback((newPosition: LocationWithAccuracy) => {
		if (!map) return;

		const latLng = toGoogleMapsLatLng(newPosition);

		// Smooth pan to new location
		if (map && 'panTo' in map) {
			(map as any).panTo(latLng);
		}
	}, []);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Handle location updates for 3D object movement
	useEffect(() => {
		if (locationState.currentLocation && isFollowingEnabled && isMapReady) {
			console.log('Updating 3D object position:', locationState.currentLocation);
			update3DObjectPosition(locationState.currentLocation);
			updateMapCenter(locationState.currentLocation);
		}
	}, [locationState.currentLocation, isFollowingEnabled, isMapReady, update3DObjectPosition, updateMapCenter]);

	// Request initial location when component mounts
	useEffect(() => {
		if (!mounted || locationState.permission === 'denied') return;

		const getInitialLocation = async () => {
			try {
				if (locationState.permission === 'prompt') {
					await requestLocation();
				}
			} catch (error) {
				console.log('Initial location request failed:', error);
			}
		};

		getInitialLocation();
	}, [mounted, locationState.permission, requestLocation]);

	// Initialize map when location is ready
	useEffect(() => {
		if (!mounted || (locationState.permission === 'prompt' && !locationState.currentLocation)) return;

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

			// Require user location - no fallback
			const currentLocation = locationState.currentLocation;
			if (!currentLocation) {
				addNotification('error', 'Location required to load map. Please enable location access.');
				return;
			}

			const center = { lat: currentLocation.lat, lng: currentLocation.lng };
			const centerWithAltitude = { ...center, altitude: 0 };

			// Map options with user location
			const mapOptions = {
				tilt: 40,
				zoom: 20,
				heading: 0,
				center,
				mapId: "15431d2b469f209e",
				disableDefaultUI: true,
				gestureHandling: "greedy",
				headingInteractionEnabled: true,
				minZoom: 19,
				maxZoom: 21
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

			// Add ambient light with mobile optimization
			const ambientLight = new THREE.AmbientLight(0xFFFFFF);
			// Reduce lighting complexity on mobile
			ambientLight.intensity = isMobile ? 0.7 : 0.5;
			(overlay as any).scene.add(ambientLight);

			// Add directional light for better mobile visibility
			if (isMobile) {
				const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
				directionalLight.position.set(0, 10, 5);
				(overlay as any).scene.add(directionalLight);
			}

			// Initialize GLTF loader
			loader = new GLTFLoader();

			// Load pin.gltf similar to trimet.js bus loading
			loader.load(
				'/labubu.glb',
				gltf => {
					// Apply transformations with mobile optimizations
					const scale = isMobile ? 10 : 15; // Slightly smaller on mobile
					gltf.scene.scale.set(scale, scale, scale);
					gltf.scene.up = new THREE.Vector3(0, 0, 1);

					// Optimize materials for mobile
					gltf.scene.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							// Reduce material complexity on mobile
							if (isMobile && child.material) {
								if (Array.isArray(child.material)) {
									child.material.forEach(mat => {
										if (mat instanceof THREE.MeshStandardMaterial) {
											mat.envMapIntensity = 0.5; // Reduce reflection intensity
										}
									});
								} else if (child.material instanceof THREE.MeshStandardMaterial) {
									child.material.envMapIntensity = 0.5;
								}
							}
						}
					});

					// Apply rotations to all children
					if (gltf.scene.children.length > 0) {
						gltf.scene.children.forEach(child => {
							child.rotation.x = Math.PI / 2;
							child.position.z = 1;
						});
					}

					// Store reference to the 3D object for position updates
					labubuObject = gltf.scene;

					// Add to overlay scene
					(overlay as any).scene.add(gltf.scene);

					// Mark map as ready for 3D object updates
					setIsMapReady(true);

					// Set initial position if we have current location
					if (currentLocation) {
						currentInterpolatedPosition.current = currentLocation;
					}

					console.log('3D object loaded and ready for movement tracking');
				},
				(progress) => {
					// Loading progress
					console.log('Loading 3D object:', progress);
				},
				(error) => {
					console.error('Error loading 3D object:', error);
					// Fallback: Create a simple red object like Google's example
					const geometry = new THREE.BoxGeometry(50, 50, 50);
					const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
					const cube = new THREE.Mesh(geometry, material);
					cube.position.set(0, 25, 0);

					// Store reference to fallback object
					labubuObject = new THREE.Group();
					labubuObject.add(cube);

					(overlay as any).scene.add(labubuObject);
					setIsMapReady(true);

					console.log('Fallback 3D object created and ready');
				}
			);
		};

		initMap();
	}, [mounted, locationState.permission, locationState.currentLocation]);

	// Cleanup animation frames on unmount
	useEffect(() => {
		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, []);

	if (!mounted || (locationState.permission === 'prompt' && !locationState.currentLocation)) {
		return (
			<div className="w-full h-full flex items-center justify-center bg-gray-100">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-2 text-gray-600">
						{locationState.permission === 'prompt' ? 'Detecting your location...' : 'Loading map...'}
					</p>
					{locationState.error && (
						<p className="mt-1 text-red-600 text-sm">{locationState.error}</p>
					)}
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

			{/* Follow mode toggle button - Bottom Left */}
			<div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
				{/* Location tracking toggle */}
				<button
					onClick={toggleFollowing}
					className={`p-3 rounded-full shadow-lg transition-all duration-200 ${
						isFollowingEnabled
							? 'bg-green-600 hover:bg-green-700 text-white'
							: 'bg-gray-600 hover:bg-gray-700 text-white'
					}`}
					title={isFollowingEnabled ? 'Following your location' : 'Click to follow your location'}
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					{locationState.isWatching && (
						<div className="absolute -top-1 -right-1 w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
					)}
				</button>

				{/* Location request button for denied permission */}
				{locationState.permission === 'denied' && (
					<button
						onClick={requestLocation}
						className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-colors"
						title="Request location permission"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.062 16.5c-.77.833.192 2.5 1.732 2.5z" />
						</svg>
					</button>
				)}
			</div>

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
			<div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
				{locationState.currentLocation && (
					<div className={`text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg ${
						isFollowingEnabled ? 'bg-green-600' : 'bg-blue-600'
					}`}>
						📍 {isFollowingEnabled ? 'Following location' : 'Location found'}
						{locationState.currentLocation.accuracy && (
							<span className="ml-1 opacity-75">
								(±{Math.round(locationState.currentLocation.accuracy)}m)
							</span>
						)}
					</div>
				)}

				{locationState.permission === 'denied' && (
					<div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
						📍 Location denied
					</div>
				)}

				{locationState.error && locationState.permission !== 'denied' && (
					<div className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
						⚠️ Location error
					</div>
				)}

				{/* Movement indicator */}
				{isFollowingEnabled && locationState.isWatching && (
					<div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
						<div className="w-2 h-2 bg-purple-300 rounded-full animate-ping"></div>
						Tracking movement
					</div>
				)}
			</div>
		</div>
	);
}