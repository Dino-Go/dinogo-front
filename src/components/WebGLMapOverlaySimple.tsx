'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface WebGLMapOverlayProps {
	className?: string;
}

export default function WebGLMapOverlaySimple({ className }: WebGLMapOverlayProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstance = useRef<google.maps.Map | null>(null);
	const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
	const [mounted, setMounted] = useState(false);
	const [mapReady, setMapReady] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Effect to get user location first
	useEffect(() => {
		if (!mounted) return;

		const getUserLocation = async () => {
			try {
				if (navigator.geolocation && locationPermission === 'prompt') {
					const position = await new Promise<GeolocationPosition>((resolve, reject) => {
						navigator.geolocation.getCurrentPosition(resolve, reject, {
							enableHighAccuracy: true,
							timeout: 10000,
							maximumAge: 60000, // 1 minute
						});
					});

					const location = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					};

					setUserLocation(location);
					setLocationPermission('granted');
				}
			} catch (error) {
				console.log('Geolocation error:', error);
				setLocationPermission('denied');
				// Still initialize map with default location
				setMapReady(true);
			}
		};

		getUserLocation();
	}, [mounted, locationPermission]);

	// Effect to initialize map after location is detected or denied
	useEffect(() => {
		if (!mounted) return;
		if (locationPermission === 'prompt') return; // Wait for location detection
		if (mapReady) return; // Map already initialized

		const initMap = async () => {
			if (!mapRef.current) return;

			// Load Google Maps JavaScript API
			if (!window.google) {
				const script = document.createElement('script');
				script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry&v=beta`;
				script.async = true;
				script.defer = true;
				document.head.appendChild(script);

				script.onload = () => {
					createMap();
				};
			} else {
				createMap();
			}
		};

		const createMap = async () => {
			if (!mapRef.current) return;

			// Use user location if available, otherwise default to Tokyo
			const initialCenter = userLocation || { lat: 35.6594945, lng: 139.6999859 };
			const initialZoom = userLocation ? 16 : 18;

			// Map configuration with 3D view
			const mapOptions: google.maps.MapOptions = {
				center: initialCenter,
				zoom: initialZoom,
				tilt: 67.5, // Enable 3D view with tilt
				heading: 0,
				mapId: "15431d2b469f209e", // Required for WebGL overlays
				disableDefaultUI: true,
				gestureHandling: 'cooperative',
				// Mobile-specific options
				zoomControl: false,
				mapTypeControl: false,
				streetViewControl: false,
				fullscreenControl: false,
			};

			// Create the map
			mapInstance.current = new google.maps.Map(mapRef.current, mapOptions);

			// Add user location marker if available
			if (userLocation && window.google) {
				new google.maps.Marker({
					position: userLocation,
					map: mapInstance.current,
					title: 'Your Location',
					icon: {
						path: google.maps.SymbolPath.CIRCLE,
						scale: 8,
						fillColor: '#4285F4',
						fillOpacity: 1,
						strokeColor: '#ffffff',
						strokeWeight: 2,
					},
				});
			}

			setMapReady(true);

			// Initialize WebGL overlay after map loads
			mapInstance.current.addListener('idle', () => {
				initWebGLOverlay();
			});
		};

		const initWebGLOverlay = async () => {
			if (!mapInstance.current) return;

			try {
				// Import Google Maps Three.js integration and GLTF loader dynamically
				const googleMapsModule = await import('@googlemaps/three');
				const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

				const { ThreeJSOverlayView } = googleMapsModule;

				// Detect mobile device for performance optimization
				const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

				// Create Three.js scene
				const scene = new THREE.Scene();

				// Add ambient light (reduced intensity on mobile)
				const ambientLight = new THREE.AmbientLight(0xffffff, isMobile ? 0.8 : 1.0);
				scene.add(ambientLight);

				// Add directional light (reduced intensity on mobile)
				const directionalLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.3 : 0.5);
				directionalLight.position.set(0.5, -1, 0.5);
				scene.add(directionalLight);

				// Load and add GLTF pin model
				let pinModel: THREE.Object3D | null = null;
				const loader = new GLTFLoader();

				try {
					const gltf = await new Promise<any>((resolve, reject) => {
						loader.load('/pin.gltf', resolve, undefined, reject);
					});

					pinModel = gltf.scene;

					if (pinModel) {
						// Scale the model appropriately (adjust as needed)
						const modelScale = isMobile ? 5 : 8;
						pinModel.scale.set(modelScale, modelScale, modelScale);

						// Position the pin at ground level
						pinModel.position.set(0, 0, 0);

						// Ensure proper materials for lighting
						pinModel.traverse((child: any) => {
							if (child.isMesh) {
								child.material.needsUpdate = true;
								// Make materials respond to lighting
								if (child.material.isMeshBasicMaterial) {
									const newMaterial = new THREE.MeshLambertMaterial({
										color: child.material.color,
										map: child.material.map
									});
									child.material = newMaterial;
								}
							}
						});

						scene.add(pinModel);
					}
				} catch (gltfError) {
					console.warn('Could not load pin.gltf, using fallback cube:', gltfError);

					// Fallback: Create a simple cube if GLTF loading fails
					const boxSize = isMobile ? 30 : 50;
					const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
					const material = new THREE.MeshLambertMaterial({
						color: userLocation ? 0x4285F4 : 0x00ff00,
						transparent: true,
						opacity: 0.8
					});
					const cube = new THREE.Mesh(geometry, material);
					cube.position.set(0, boxSize / 2, 0);
					scene.add(cube);
					pinModel = cube;
				}

				// Add location-based markers if user location is available
				if (userLocation) {
					const markerGeometry = new THREE.SphereGeometry(10, isMobile ? 8 : 16, isMobile ? 8 : 16);
					const markerMaterial = new THREE.MeshLambertMaterial({ color: 0xff4444 });
					const locationMarker = new THREE.Mesh(markerGeometry, markerMaterial);
					locationMarker.position.set(20, 10, 20);
					scene.add(locationMarker);
				}

				// Use user location for WebGL overlay anchor if available
				const overlayAnchor = userLocation || { lat: 35.6594945, lng: 139.6999859 };

				// Create WebGL overlay
				const overlay = new ThreeJSOverlayView({
					map: mapInstance.current,
					scene,
					anchor: {
						...overlayAnchor,
						altitude: 100
					},
					THREE
				});

				// Mobile-optimized animation with frame rate limiting
				let lastTime = 0;
				const targetFPS = isMobile ? 30 : 60;
				const frameInterval = 1000 / targetFPS;

				const animate = (currentTime: number) => {
					if (currentTime - lastTime >= frameInterval) {
						if (pinModel) {
							// Gentle rotation for the pin model (rotate around Y axis only)
							const rotationSpeed = isMobile ? 0.005 : 0.01;
							pinModel.rotation.y += rotationSpeed;
						}
						overlay.requestRedraw();
						lastTime = currentTime;
					}
					requestAnimationFrame(animate);
				};
				animate(0);

			} catch (error) {
				console.error('Error initializing WebGL overlay:', error);

				// Fallback: Show message that dependencies need to be installed
				const fallbackDiv = document.createElement('div');
				fallbackDiv.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 1000;
          max-width: 400px;
          text-align: center;
        `;
				fallbackDiv.innerHTML = `
          <h3 style="margin: 0 0 16px 0; color: #333;">WebGL Overlay Setup Required</h3>
          <p style="margin: 0 0 16px 0; color: #666;">Please install required dependencies:</p>
          <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 16px 0; font-family: monospace; font-size: 14px;">
            npm install three @googlemaps/three @types/three
          </div>
          <p style="margin: 0; color: #666; font-size: 14px;">Then restart the development server.</p>
        `;
				mapRef.current?.appendChild(fallbackDiv);
			}
		};

		initMap();

		// Cleanup
		return () => {
			if (mapInstance.current) {
				mapInstance.current = null;
			}
		};
	}, [mounted, locationPermission, userLocation, mapReady]);

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
			if (mapInstance.current) {
				mapInstance.current.setCenter(location);
				mapInstance.current.setZoom(16);
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

			{/* Location status indicator */}
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