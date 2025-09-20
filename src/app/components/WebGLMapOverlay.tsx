'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { ThreeJSOverlayView } from "@googlemaps/three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { toGoogleMapsLatLng, interpolateLocation, isMobileDevice, calculateDistance } from '@/utils/geoUtils';
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

// Camera tracking variables (trimet.js style)
const cameraFocusOn = { enabled: false }; // Camera tracking state
const mapCenter = { lat: 0, lng: 0 }; // Current map center for incremental movement

export default function WebGLMapOverlay({ className }: WebGLMapOverlayProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);
	const [isMapReady, setIsMapReady] = useState(false);
	const [isMapInitialized, setIsMapInitialized] = useState(false);
	const [isCameraTracking, setIsCameraTracking] = useState(false);
	const animationFrameRef = useRef<number | null>(null);
	const targetPositionRef = useRef<LocationWithAccuracy | null>(null);
	const currentInterpolatedPosition = useRef<LocationWithAccuracy | null>(null);
	const interpolationStartTime = useRef<number>(0);
	const previousObjectRef = useRef<THREE.Group | null>(null);
	const lastCameraUpdateRef = useRef<number>(0);
	const initialLocationRef = useRef<LocationWithAccuracy | null>(null);

	// Mobile device detection
	const isMobile: boolean = isMobileDevice();
	const interpolationDuration = isMobile ? 3000 : 2000; // Mobile-optimized duration
	const cameraUpdateThrottle = 500; // Minimum 500ms between camera updates

	// Wallet functionality
	const currentAccount = useCurrentAccount();
	const { mutate: disconnect } = useDisconnectWallet();
	const router = useRouter();
	const { addNotification } = useToast();

	// Location tracking - always active with optimized settings
	const {
		state: locationState,
		startWatching,
		requestLocation
	} = useLocationTracking({
		enableHighAccuracy: true,
		timeout: 10000,
		maximumAge: 60000,
		minDistanceThreshold: 5, // 5 meters to reduce micro-movements
		updateThrottle: 2000, // 2 seconds to prevent rapid camera updates
		maxAccuracy: 50 // 50 meters max accuracy
	});

	const handleDisconnect = () => {
		disconnect();
		router.push('/');
	};

	const formatAddress = (address: string) => {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	// Pan map to user's current location
	const goToMyLocation = useCallback(() => {
		if (locationState.currentLocation && map) {
			const latLng = toGoogleMapsLatLng(locationState.currentLocation);
			(map as any).panTo(latLng);
			addNotification('info', 'Centered on your location');
		} else if (!locationState.currentLocation) {
			addNotification('info', 'Location not available');
		}
	}, [locationState.currentLocation, addNotification]);

	// Toggle camera tracking
	const toggleCameraTracking = useCallback(() => {
		const newTracking = !isCameraTracking;
		setIsCameraTracking(newTracking);
		cameraFocusOn.enabled = newTracking;

		if (newTracking && locationState.currentLocation) {
			// Initialize map center for tracking
			mapCenter.lat = locationState.currentLocation.lat;
			mapCenter.lng = locationState.currentLocation.lng;
		}

		addNotification('info', newTracking ? 'Camera tracking enabled' : 'Camera tracking disabled');
	}, [isCameraTracking, locationState.currentLocation, addNotification]);


	// Camera movement function (safe implementation to prevent flickering)
	const moveCamera = useCallback((objectPosition: THREE.Vector3) => {
		if (!cameraFocusOn.enabled || !map || !overlay) return;

		const now = Date.now();

		// Throttle camera updates to prevent flickering
		if (now - lastCameraUpdateRef.current < cameraUpdateThrottle) {
			return;
		}

		// Convert object position back to lat/lng coordinates
		// Try using the overlay method, fallback to approximation if not available
		let objectLatLng;
		try {
			objectLatLng = (overlay as any).vector3ToLatLngAltitude?.(objectPosition);
		} catch {
			// Fallback: use current interpolated position if conversion fails
			objectLatLng = currentInterpolatedPosition.current;
		}

		if (!objectLatLng) return;

		// Calculate distance from current map center to object
		const currentCenter = (map as any).getCenter();
		if (!currentCenter) return;

		const currentCenterLat = currentCenter.lat();
		const currentCenterLng = currentCenter.lng();

		// Calculate distance to determine if camera movement is needed
		const distance = Math.sqrt(
			Math.pow(objectLatLng.lat - currentCenterLat, 2) +
			Math.pow(objectLatLng.lng - currentCenterLng, 2)
		);

		// Only move camera if object is far enough from center (prevent micro-movements)
		const moveThreshold = 0.0001; // ~11 meters at equator
		if (distance < moveThreshold) return;

		// Smooth camera movement - interpolate towards object position
		const lerpFactor = 0.1; // 10% movement each update for smooth following
		const newLat = currentCenterLat + (objectLatLng.lat - currentCenterLat) * lerpFactor;
		const newLng = currentCenterLng + (objectLatLng.lng - currentCenterLng) * lerpFactor;

		// Update map center without affecting zoom, tilt, heading
		const newCenter = { lat: newLat, lng: newLng };

		// Get current camera state to preserve zoom, tilt, heading
		const currentMapOptions = {
			center: newCenter,
			zoom: (map as any).getZoom(),
			tilt: (map as any).getTilt(),
			heading: (map as any).getHeading()
		};

		// Move camera with explicit preservation of view parameters
		(map as any).moveCamera(currentMapOptions);

		// Update our tracking variables
		mapCenter.lat = newLat;
		mapCenter.lng = newLng;
		lastCameraUpdateRef.current = now;
	}, [cameraUpdateThrottle]);

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
	}, [interpolationDuration]);

	// Update 3D object position using trimet.js object cloning pattern
	const update3DObjectPosition = useCallback((newPosition: LocationWithAccuracy) => {
		if (!overlay || !labubuObject || !isMapReady) return;

		// If this is the first position, jump immediately
		if (!currentInterpolatedPosition.current) {
			currentInterpolatedPosition.current = newPosition;
			targetPositionRef.current = newPosition;

			// Convert location to 3D position
			const objectPosition = (overlay as any).latLngAltitudeToVector3({
				lat: newPosition.lat,
				lng: newPosition.lng,
				altitude: newPosition.altitude || 0
			});

			// Create and position the object (trimet.js style)
			if (labubuObject) {
				const objectClone = labubuObject.clone();
				objectClone.position.copy(objectPosition);

				// Add to scene and store reference
				(overlay as any).scene.add(objectClone);
				previousObjectRef.current = objectClone;
			}

			// Initialize map center for camera tracking
			if (cameraFocusOn.enabled) {
				mapCenter.lat = newPosition.lat;
				mapCenter.lng = newPosition.lng;
			}

			return;
		}

		// Check if the new position is significantly different from current target
		const distanceFromTarget = targetPositionRef.current
			? calculateDistance(targetPositionRef.current, newPosition)
			: Infinity;

		// Only start new animation if position change is significant (>2 meters)
		if (distanceFromTarget < 2) return;

		// Set new target position
		targetPositionRef.current = newPosition;

		// If no animation is running, start from current interpolated position
		if (!animationFrameRef.current) {
			interpolationStartTime.current = Date.now();
		} else {
			// Animation is running - smoothly transition to new target
			// Keep the current interpolation start time to avoid jarring changes
			const elapsed = Date.now() - interpolationStartTime.current;
			const remainingDuration = Math.max(interpolationDuration - elapsed, 500); // At least 500ms
			interpolationStartTime.current = Date.now() - (interpolationDuration - remainingDuration);
		}

		// Start animation loop for smooth movement (trimet.js style)
		const animate = () => {
			if (!targetPositionRef.current || !currentInterpolatedPosition.current) return;

			const elapsed = Date.now() - interpolationStartTime.current;
			const interpolatedPos = interpolatePosition(currentInterpolatedPosition.current, targetPositionRef.current, elapsed);

			// Convert interpolated position to 3D coordinates
			const objectPosition = (overlay as any).latLngAltitudeToVector3({
				lat: interpolatedPos.lat,
				lng: interpolatedPos.lng,
				altitude: interpolatedPos.altitude || 0
			});

			// Calculate forward direction for lookAt (similar to trimet.js)
			const nextPos = {
				lat: interpolatedPos.lat + 0.0001,
				lng: interpolatedPos.lng + 0.0001,
				altitude: interpolatedPos.altitude || 0
			};
			const forwardPosition = (overlay as any).latLngAltitudeToVector3(nextPos);

			// Remove previous object and create new one (trimet.js pattern)
			if (previousObjectRef.current) {
				(overlay as any).scene.remove(previousObjectRef.current);
			}

			// Create new object and position it
			if (labubuObject) {
				const objectClone = labubuObject.clone();
				objectClone.position.copy(objectPosition);
				objectClone.lookAt(forwardPosition); // Orient object in movement direction
				(overlay as any).scene.add(objectClone);
				previousObjectRef.current = objectClone;
			}

			// Update camera tracking only when animation is near completion to prevent flickering
			const animationProgress = elapsed / interpolationDuration;
			if (animationProgress > 0.8 || elapsed >= interpolationDuration) {
				moveCamera(objectPosition);
			}

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

		// Cancel any existing animation before starting new one
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}

		// Start new animation
		animationFrameRef.current = requestAnimationFrame(animate);
	}, [isMapReady, interpolatePosition, interpolationDuration, moveCamera]);


	useEffect(() => {
		setMounted(true);
	}, []);

	// Handle location updates for 3D object movement - always active
	useEffect(() => {
		if (locationState.currentLocation && isMapReady) {
			console.log('Updating 3D object position:', locationState.currentLocation);
			update3DObjectPosition(locationState.currentLocation);
		}
	}, [locationState.currentLocation, isMapReady, update3DObjectPosition]);

	// Request initial location and start tracking when component mounts
	useEffect(() => {
		if (!mounted || locationState.permission === 'denied') return;

		const initializeLocation = async () => {
			try {
				if (locationState.permission === 'prompt') {
					await requestLocation();
				}
				// Always start watching location if we have permission
				if (locationState.permission === 'granted' && !locationState.isWatching) {
					startWatching();
				}
			} catch (error) {
				console.log('Initial location setup failed:', error);
			}
		};

		initializeLocation();
	}, [mounted, locationState.permission, locationState.isWatching, requestLocation, startWatching]);

	// Ensure location tracking is always active when permission is granted
	useEffect(() => {
		if (locationState.permission === 'granted' && !locationState.isWatching) {
			startWatching();
		}
	}, [locationState.permission, locationState.isWatching, startWatching]);

	// Check for initial location and trigger map initialization
	useEffect(() => {
		if (!mounted || isMapInitialized) return;
		if (locationState.permission !== 'granted' || !locationState.currentLocation) return;

		// Capture initial location and trigger map initialization
		initialLocationRef.current = locationState.currentLocation;
		setIsMapInitialized(true);
	}, [mounted, isMapInitialized, locationState.permission, locationState.currentLocation]);

	// Initialize map ONCE when isMapInitialized becomes true - NEVER runs again after initial creation
	useEffect(() => {
		if (!isMapInitialized || !initialLocationRef.current) return;

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

			// Use the captured initial location (won't change on subsequent location updates)
			const currentLocation = initialLocationRef.current;
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

			// Create overlay similar to trimet.js (without anchor dependency)
			overlay = new ThreeJSOverlayView({
				map,
				anchor: centerWithAltitude, // Initial anchor, but we'll position objects directly
				scene: new THREE.Scene(),
				THREE,
			});

			// Initialize map center for camera tracking
			mapCenter.lat = currentLocation.lat;
			mapCenter.lng = currentLocation.lng;

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
							child.position.z = isMobile ? -10 : 1;
						});
					}

					// Store reference to the 3D object for cloning (trimet.js style)
					labubuObject = gltf.scene;

					// DON'T add to scene immediately - we'll clone and position objects manually

					// Mark map as ready for 3D object updates
					setIsMapReady(true);

					// Set initial position if we have current location
					if (currentLocation) {
						currentInterpolatedPosition.current = currentLocation;
					}

					console.log('3D object template loaded and ready for trimet.js-style cloning');
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

					// Store reference to fallback object (trimet.js style)
					labubuObject = new THREE.Group();
					labubuObject.add(cube);

					// DON'T add to scene immediately - we'll clone and position objects manually
					setIsMapReady(true);

					console.log('Fallback 3D object template created and ready for trimet.js-style cloning');
				}
			);
		};

		initMap();
	}, [isMapInitialized, addNotification, isMobile]); // Removed locationState.currentLocation!

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

			{/* Location tracking status and controls - Bottom Left */}
			<div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
				{/* Location tracking status - always enabled */}
				<div className="p-3 rounded-full shadow-lg bg-green-600 text-white" title="Location tracking active">
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					{locationState.isWatching && (
						<div className="absolute -top-1 -right-1 w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
					)}
				</div>

				{/* Go to my location button - always visible */}
				<button
					onClick={goToMyLocation}
					className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
					title="Center map on your location"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4m8-10h-4M6 12H2" />
						<circle cx="12" cy="12" r="2" fill="currentColor" />
					</svg>
				</button>

				{/* Camera tracking toggle button */}
				<button
					onClick={toggleCameraTracking}
					className={`p-3 rounded-full shadow-lg transition-colors ${
						isCameraTracking
							? 'bg-orange-600 hover:bg-orange-700 text-white'
							: 'bg-gray-600 hover:bg-gray-700 text-white'
					}`}
					title={isCameraTracking ? 'Camera tracking enabled - click to disable' : 'Camera tracking disabled - click to enable'}
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
					</svg>
					{isCameraTracking && (
						<div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-300 rounded-full animate-pulse"></div>
					)}
				</button>
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
					<div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
						📍 Tracking location
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
				{locationState.isWatching && (
					<div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
						<div className="w-2 h-2 bg-purple-300 rounded-full animate-ping"></div>
						Tracking movement
					</div>
				)}

				{/* Camera tracking indicator */}
				{isCameraTracking && (
					<div className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
						<div className="w-2 h-2 bg-orange-300 rounded-full animate-pulse"></div>
						📹 Camera following
					</div>
				)}
			</div>
		</div>
	);
}