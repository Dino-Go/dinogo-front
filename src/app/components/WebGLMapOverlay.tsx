'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import { useCheckpoints } from '@/hooks/useCheckpoints';

// Google Maps type declarations
declare global {
  interface Window {
    google: any;
  }
}

interface WebGLMapOverlayProps {
  className?: string;
}

// Helper function to calculate distance between two coordinates
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Helper function to calculate bearing/heading between two coordinates
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = deg2rad(lon2 - lon1);
  const lat1Rad = deg2rad(lat1);
  const lat2Rad = deg2rad(lat2);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(y, x);
  return (bearing * 180 / Math.PI + 360) % 360; // Convert to degrees and normalize
}

export default function WebGLMapOverlay({ className }: WebGLMapOverlayProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapKey, setMapKey] = useState(0); // For forcing map re-initialization

  // User location and view tracking states
  const [userLocation, setUserLocation] = useState({ lat: 40.7614, lng: -73.9776, altitude: 10 });
  const [cameraView, setCameraView] = useState({ tilt: 0, heading: 0, zoom: 18 });
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [userHeading, setUserHeading] = useState(0); // User's direction of movement
  const [lastPosition, setLastPosition] = useState<{ lat: number, lng: number } | null>(null);
  const [isNavigationMode, setIsNavigationMode] = useState(true); // Auto-follow user
  const userGltfRef = useRef<any>(null);
  const checkpointGltfRefs = useRef<Map<string, any>>(new Map());
  const mapInstanceRef = useRef<any>(null);
  const currentLocationRef = useRef(userLocation);
  const checkpoints = useCheckpoints();
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

  // Continuous location tracking
  useEffect(() => {
    if (!mounted) return;

    let watchId: number | null = null;

    const startLocationTracking = () => {
      if ('geolocation' in navigator) {
        setIsLocationTracking(true);
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newUserLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              altitude: position.coords.altitude || 0
            };

            // Calculate heading if we have a previous position
            if (lastPosition) {
              const distance = getDistanceFromLatLonInKm(
                lastPosition.lat, lastPosition.lng,
                newUserLocation.lat, newUserLocation.lng
              );

              // Only update heading if user moved more than 5 meters (to avoid jitter)
              if (distance > 0.005) {
                const bearing = calculateBearing(
                  lastPosition.lat, lastPosition.lng,
                  newUserLocation.lat, newUserLocation.lng
                );
                setUserHeading(bearing);
                console.log(`User heading: ${bearing.toFixed(1)}°, moved ${(distance * 1000).toFixed(0)}m`);
              }
            }

            setUserLocation(newUserLocation);
            setLastPosition({ lat: newUserLocation.lat, lng: newUserLocation.lng });

            // Update GLTF position if it exists
            if (userGltfRef.current) {
              console.log(`Updating user position to: ${newUserLocation.lat}, ${newUserLocation.lng}`);
            }
          },
          (error) => {
            console.warn('Location tracking error:', error);
            setIsLocationTracking(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000 // Update every 5 seconds at most
          }
        );
      }
    };

    startLocationTracking();

    // Cleanup function
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setIsLocationTracking(false);
      }
    };
  }, [mounted]);

  // Update GLTF position when user location changes
  useEffect(() => {
    // Update the ref so WebGL functions can access current location
    currentLocationRef.current = userLocation;

    if (userGltfRef.current) {
      // Position the GLTF at the current user location
      console.log(`GLTF positioned at: ${userLocation.lat}, ${userLocation.lng}, altitude: ${userLocation.altitude}`);

      // Note: The actual positioning happens in the WebGL onDraw method
      // using the transformer.fromLatLngAltitude with current userLocation
    }

    // Navigation mode: auto-follow user with camera rotation
    if (isNavigationMode && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const currentCenter = (map as any).getCenter?.();

      if (currentCenter) {
        const distance = getDistanceFromLatLonInKm(
          currentCenter.lat(),
          currentCenter.lng(),
          userLocation.lat,
          userLocation.lng
        );

        // Always follow in navigation mode (more sensitive than 100m)
        if (distance > 0.01) { // 10 meters
          console.log(`Navigation mode: Following user ${(distance * 1000).toFixed(0)}m`);

          // Smooth camera movement with heading alignment
          (map as any).moveCamera?.({
            center: { lat: userLocation.lat, lng: userLocation.lng },
            heading: userHeading, // Point camera in direction of movement
            tilt: 60, // Good angle for navigation
            zoom: Math.max(18, cameraView.zoom) // Keep good zoom level
          });
        }
      }
    }
  }, [userLocation]);


  // Effect to trigger map re-initialization when checkpoints are first loaded
  useEffect(() => {
    if (isMapReady && !checkpoints.loading && checkpoints.checkpoints && checkpoints.checkpoints.length > 0) {
      console.log('🔄 Checkpoints loaded! Re-initializing map for better pin loading...');
      setIsMapReady(false);
      setMapKey(prev => prev + 1);
    }
  }, [checkpoints.loading, checkpoints.checkpoints]);

  useEffect(() => {
    if (!mounted || !mapRef.current) return;

    // Function to load checkpoint pins immediately when WebGL is ready
    const loadCheckpointPinsNow = async (loader: any, scene: any, THREE: any) => {
      if (!checkpoints.checkpoints || checkpoints.checkpoints.length === 0) {
        return;
      }

      console.log(`🚀 Loading ${checkpoints.checkpoints.length} checkpoint pins immediately...`);

      // Clear existing pins
      checkpointGltfRefs.current.forEach((pinData) => {
        if (pinData.model && pinData.model.parent) {
          pinData.model.parent.remove(pinData.model);
        }
      });
      checkpointGltfRefs.current.clear();

      // Load pins for each checkpoint
      for (const checkpoint of checkpoints.checkpoints) {
        try {
          console.log(`📍 Loading pin for: ${checkpoint.label}`);

          // Try to load pin.gltf
          const gltf = await new Promise<any>((resolve, reject) => {
            loader.load("/meat.glb", resolve, undefined, reject);
          });

          // Large scale for better visibility
          gltf.scene.scale.set(600, 600, 600); // Even larger!
          gltf.scene.rotation.x = Math.PI;

          // Add to scene and store reference
          scene.add(gltf.scene);
          checkpointGltfRefs.current.set(checkpoint.id, {
            model: gltf.scene,
            checkpoint: checkpoint
          });

          console.log(`✅ Pin loaded: ${checkpoint.label} at (${checkpoint.lat}, ${checkpoint.lng})`);

        } catch (error) {
          console.log(`❌ Failed to load pin for ${checkpoint.label}, creating bright fallback`);

          // Create very bright, large fallback pin
          const fallbackGeometry = new THREE.CylinderGeometry(30, 30, 120, 8);
          const fallbackMaterial = new THREE.MeshLambertMaterial({
            color: 0xff0000,
            emissive: 0x990000
          });
          const fallbackPin = new THREE.Mesh(fallbackGeometry, fallbackMaterial);

          // Add to scene and store reference
          scene.add(fallbackPin);
          checkpointGltfRefs.current.set(checkpoint.id, {
            model: fallbackPin,
            checkpoint: checkpoint
          });

          console.log(`🔴 Bright fallback pin created: ${checkpoint.label}`);
        }
      }

      console.log(`🎉 Total pins loaded: ${checkpointGltfRefs.current.size}`);
    };

    const initMap = async () => {
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

      // Get user location
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          });
        });

        const newUserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          altitude: position.coords.altitude || 0
        };

        setUserLocation(newUserLocation);
      } catch (error) {
        console.log('Using default location:', error);
        // Keep the default location set in state
      }

      // Map options - start with some tilt for 3D effect
      const mapOptions = {
        tilt: 45, // Start with initial tilt for 3D view
        heading: cameraView.heading,
        zoom: cameraView.zoom,
        center: { lat: userLocation.lat, lng: userLocation.lng },
        mapId: "15431d2b469f209e",
        disableDefaultUI: true,
        gestureHandling: "greedy",
        headingInteractionEnabled: true,
        minZoom: 10,
        maxZoom: 21
      };

      // Create map
      const map = new google.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map;

      // Add map event listeners to track camera view changes
      // Note: Using any type casting for 3D map methods not in standard types
      map.addListener('tilt_changed', () => {
        const tilt = (map as any).getTilt?.() || 0;
        setCameraView(prev => ({ ...prev, tilt }));
      });

      map.addListener('heading_changed', () => {
        const heading = (map as any).getHeading?.() || 0;
        setCameraView(prev => ({ ...prev, heading }));
      });

      map.addListener('zoom_changed', () => {
        const zoom = (map as any).getZoom?.() || 18;
        setCameraView(prev => ({ ...prev, zoom }));
      });

      // Disable navigation mode when user manually interacts with map
      map.addListener('dragstart', () => {
        if (isNavigationMode) {
          console.log('User interaction detected, disabling navigation mode');
          setIsNavigationMode(false);
        }
      });

      map.addListener('center_changed', () => {
        const center = (map as any).getCenter?.();
        if (center) {
          // Only update if not in navigation mode (to avoid interference)
          if (!isNavigationMode) {
            setUserLocation(prev => ({
              ...prev,
              lat: center.lat(),
              lng: center.lng()
            }));
          }
        }
      });

      // Initialize WebGL overlay
      initWebglOverlayView(map);

      setIsMapReady(true);
    };

    // Function to update GLTF position based on user location
    const updateUserGltfPosition = (gltf: any) => {
      if (gltf) {
        // Position the GLTF object at the user's location
        gltf.position.set(0, 0, 0); // Reset to origin since we use transformer
      }
    };

    const initWebglOverlayView = (map: google.maps.Map) => {
      let scene: any, renderer: any, camera: any, loader: any;
      const webglOverlayView = new (google.maps as any).WebGLOverlayView();


      webglOverlayView.onAdd = () => {
        // Import THREE.js dynamically
        import('three').then((THREE) => {
          scene = new THREE.Scene();
          camera = new THREE.PerspectiveCamera();

          const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
          scene.add(ambientLight);

          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
          directionalLight.position.set(0.5, -1, 0.5);
          scene.add(directionalLight);


          // Fallback marker creation function
          const createFallbackMarker = () => {
            const geometry = new THREE.ConeGeometry(5, 20, 8);
            const material = new THREE.MeshLambertMaterial({ color: 0x0066ff });
            const marker = new THREE.Mesh(geometry, material);
            marker.rotation.x = Math.PI; // Point upward
            userGltfRef.current = marker;
            scene.add(marker);
            console.log('Created fallback geometric marker');
          };

          // Load GLTF loader
          import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
            loader = new GLTFLoader();

            // Load user marker
            loader.load(
              "/raptor.glb",
              (gltf: any) => {
                // Scale and orient the model for navigation use
                gltf.scene.scale.set(10, 10, 10); // Slightly larger for visibility
                gltf.scene.rotation.x = Math.PI / 2; // Orient upright
                gltf.scene.position.z = 20; // Will be updated based on user heading

                userGltfRef.current = gltf.scene;
                scene.add(gltf.scene);
                updateUserGltfPosition(gltf.scene);
              },
              undefined,
              (error: any) => {
                console.log('Failed to load user marker model:', error);
                // Create a simple geometric marker as fallback
                createFallbackMarker();
              }
            );

            // Store loader and scene for external checkpoint loading
            (webglOverlayView as any).loader = loader;
            (webglOverlayView as any).scene = scene;
            (webglOverlayView as any).THREE = THREE;

            console.log('WebGL overlay ready for checkpoint pin loading');

            // If checkpoint data is already available, load pins immediately
            if (checkpoints.checkpoints && checkpoints.checkpoints.length > 0) {
              console.log('🎯 Checkpoint data available! Loading pins immediately...');
              loadCheckpointPinsNow(loader, scene, THREE);
            }

          });
        });
      };

      webglOverlayView.onContextRestored = ({ gl }: any) => {
        import('three').then((THREE) => {
          renderer = new THREE.WebGLRenderer({
            canvas: gl.canvas,
            context: gl,
            ...gl.getContextAttributes(),
          });
          renderer.autoClear = false;

          // Start animation loop immediately
          const startAnimation = () => {
            renderer.setAnimationLoop(() => {
              webglOverlayView.requestRedraw();

              // Simple animation - gradually increase tilt if needed
              const currentTilt = (map as any).getTilt?.() || 0;
              const currentHeading = (map as any).getHeading?.() || 0;
              const currentZoom = (map as any).getZoom?.() || 18;

              if (currentTilt < 40) {
                (map as any).moveCamera?.({
                  tilt: currentTilt + 0.5,
                  heading: currentHeading,
                  zoom: currentZoom
                });
              }
            });
          };

          // Start animation regardless of model loading
          setTimeout(startAnimation, 100);

          // Also trigger when loader finishes (if available)
          if (loader?.manager) {
            loader.manager.onLoad = startAnimation;
          }
        });
      };

      webglOverlayView.onDraw = ({ transformer }: any) => {
        import('three').then((THREE) => {
          if (!renderer || !scene || !camera) return;

          // Use current user location for positioning the GLTF object
          const currentLoc = currentLocationRef.current;

          // Detect mobile device and fix altitude issues
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const safeAltitude = isMobile ? 5 : 10; // Cap altitude for mobile

          const latLngAltitudeLiteral = {
            lat: currentLoc.lat,
            lng: currentLoc.lng,
            altitude: safeAltitude,
          };

          const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
          camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

          // Update GLTF object position and rotation to match user location and heading
          if (userGltfRef.current) {
            // Position user marker at ground level based on device type
            const userZ = isMobile ? -30 : -10; // Lower on mobile to ensure ground contact
            userGltfRef.current.position.set(0, 0, userZ);

            // Rotate the marker to face the direction of movement
            const headingRadians = (userHeading * Math.PI) / 180;
            userGltfRef.current.rotation.z = -headingRadians;

            // Debug mobile positioning occasionally
            if (isMobile && Math.random() < 0.01) {
              console.log(`📱 Mobile user marker: altitude=${safeAltitude}m, z=${userZ}, heading=${userHeading.toFixed(1)}°`);
            }
          }

          // Update checkpoint pin positions
          checkpointGltfRefs.current.forEach((pinData) => {
            if (pinData.model && pinData.checkpoint) {
              // Calculate relative position from user location to checkpoint
              const checkpoint = pinData.checkpoint;

              // Calculate distance and bearing for better positioning
              const distance = getDistanceFromLatLonInKm(
                currentLoc.lat, currentLoc.lng,
                checkpoint.lat, checkpoint.lng
              ) * 1000; // Convert to meters

              const bearing = calculateBearing(
                currentLoc.lat, currentLoc.lng,
                checkpoint.lat, checkpoint.lng
              );

              // Convert to radians and position using polar coordinates
              const bearingRad = bearing * Math.PI / 180;
              const x = Math.sin(bearingRad) * distance;
              const y = Math.cos(bearingRad) * distance;
              const z = 50; // Even higher for better visibility (120x scale)

              pinData.model.position.set(x, y, z);

              // Debug occasionally for positioning verification
              if (Math.random() < 0.005) { // 0.5% chance for logging
                console.log(`📍 Pin "${checkpoint.label}": ${distance.toFixed(0)}m away at bearing ${bearing.toFixed(0)}°, pos=(${x.toFixed(0)}, ${y.toFixed(0)}, ${z})`);
              }
            }
          });


          renderer.render(scene, camera);
          renderer.resetState();
        });
      };

      webglOverlayView.setMap(map);

      // Store reference to webgl overlay for later access
      (map as any)._webglOverlayView = webglOverlayView;
    };

    initMap();
  }, [mounted, mapKey]); // Re-initialize when mapKey changes


  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading map...</p>
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

      {/* Map status indicator and tracking info - Top Left */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        {/* Navigation mode toggle */}
        <div className="bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg">
          <div className="font-bold mb-1 flex items-center gap-2">
            🧭 Navigation Mode
            {isNavigationMode && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            )}
          </div>
          <button
            onClick={() => setIsNavigationMode(!isNavigationMode)}
            className={`text-xs px-2 py-1 rounded transition-colors ${isNavigationMode
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-gray-500 hover:bg-gray-600'
              }`}
          >
            {isNavigationMode ? '🔄 Auto-Follow ON' : '📍 Manual Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}