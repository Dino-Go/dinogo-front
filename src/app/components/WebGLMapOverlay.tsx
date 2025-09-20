'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import { useCheckpoints, extractCoordinates } from '@/hooks/useCheckpoints';

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

  // User location and view tracking states
  const [userLocation, setUserLocation] = useState({ lat: 40.7614, lng: -73.9776, altitude: 0 });
  const [cameraView, setCameraView] = useState({ tilt: 0, heading: 0, zoom: 18 });
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [userHeading, setUserHeading] = useState(0); // User's direction of movement
  const [lastPosition, setLastPosition] = useState<{ lat: number, lng: number } | null>(null);
  const [isNavigationMode, setIsNavigationMode] = useState(true); // Auto-follow user
  const userGltfRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const currentLocationRef = useRef(userLocation);
  const checkpointPinsRef = useRef<any[]>([]);

  // Wallet functionality
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const router = useRouter();

  // Checkpoint coordinates from blockchain
  const { checkpoints, loading: checkpointsLoading } = useCheckpoints();
  const checkpointCoordinates = extractCoordinates(checkpoints);

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

  useEffect(() => {
    if (!mounted || !mapRef.current) return;

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
    const updateUserGltfPosition = (gltf: any, lat: number, lng: number, altitude: number = 0) => {
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

          // Load GLTF loader
          import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
            loader = new GLTFLoader();

            loader.load(
              "/labubu.glb",
              (gltf: any) => {
                // Scale and orient the model for navigation use
                gltf.scene.scale.set(15, 15, 15); // Slightly larger for visibility
                gltf.scene.rotation.x = Math.PI / 2; // Orient upright
                gltf.scene.rotation.z = 7.5; // Will be updated based on user heading

                userGltfRef.current = gltf.scene;
                scene.add(gltf.scene);
                updateUserGltfPosition(gltf.scene, userLocation.lat, userLocation.lng, userLocation.altitude);
              },
              undefined,
              (error: any) => {
                console.log('Failed to load user marker model:', error);
                // Create a simple geometric marker as fallback
                createFallbackMarker();
              }
            );

            // Clear existing pins
            checkpointPinsRef.current.forEach(pin => {
              scene.remove(pin);
            });
            checkpointPinsRef.current = [];

            // Load pins for each checkpoint
            checkpointCoordinates.forEach((checkpoint, index) => {
              loader.load(
                '/pin.gltf',
                (gltf: any) => {
                  const pin = gltf.scene.clone();
                  pin.scale.set(10, 10, 10);
                  pin.rotation.x = Math.PI / 2;
                  pin.rotation.z = 0;

                  // Store checkpoint data on the pin object
                  console.log(checkpoint)
                  pin.userData = {
                    checkpointId: checkpoint.id,
                    lat: checkpoint.lat,
                    lng: checkpoint.lng,
                    label: checkpoint.label
                  };

                  checkpointPinsRef.current.push(pin);
                  scene.add(pin);
                  console.log(`Loaded checkpoint pin: ${checkpoint.label} at ${checkpoint.lat}, ${checkpoint.lng}`);
                },
                undefined,
                (error: any) => {
                  console.log(`Failed to load pin for checkpoint ${checkpoint.label}:`, error);
                }
              );
            });

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
          const latLngAltitudeLiteral = {
            lat: currentLoc.lat,
            lng: currentLoc.lng,
            altitude: currentLoc.altitude,
          };

          const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
          camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

          // Update GLTF object position and rotation to match user location and heading
          if (userGltfRef.current) {
            // The GLTF object is positioned relative to the transformed coordinate system
            // Since we're transforming to the user's location, the object should be at origin
            userGltfRef.current.position.set(0, 0, 0);

            // Rotate the marker to face the direction of movement
            // Convert heading to radians and apply rotation
            const headingRadians = (userHeading * Math.PI) / 180;
            userGltfRef.current.rotation.z = -headingRadians; // Negative for correct orientation
          }

          // Update checkpoint pins positions
          checkpointPinsRef.current.forEach(pin => {
            if (pin.userData) {
              // Transform each checkpoint's lat/lng to world coordinates
              const checkpointLatLng = {
                lat: pin.userData.lat,
                lng: pin.userData.lng,
                altitude: 100 // Slightly elevated so pins are visible
              };

              // Get the matrix for this checkpoint's position
              const checkpointMatrix = transformer.fromLatLngAltitude(checkpointLatLng);

              // Apply the transformation to position the pin
              const position = new THREE.Vector3();
              const rotation = new THREE.Quaternion();
              const scale = new THREE.Vector3();

              new THREE.Matrix4().fromArray(checkpointMatrix).decompose(position, rotation, scale);

              // Transform from user location to checkpoint location
              const userMatrix = new THREE.Matrix4().fromArray(matrix);
              const relativeMatrix = new THREE.Matrix4().copy(new THREE.Matrix4().fromArray(checkpointMatrix)).multiply(userMatrix.invert());

              relativeMatrix.decompose(position, rotation, scale);
              pin.position.copy(position);
            }
          });

          renderer.render(scene, camera);
          renderer.resetState();
        });
      };

      webglOverlayView.setMap(map);
    };

    initMap();
  }, [mounted]);

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
        {isMapReady && (
          <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
            🗺️ WebGL Map Ready
          </div>
        )}

        {/* User location tracking */}
        <div className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg">
          <div className="font-bold mb-1 flex items-center gap-2">
            📍 User Location
            {isLocationTracking && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            )}
          </div>
          <div className="font-mono text-xs">
            Lat: {userLocation.lat.toFixed(6)}<br />
            Lng: {userLocation.lng.toFixed(6)}<br />
            Alt: {userLocation.altitude.toFixed(1)}m<br />
            Heading: {userHeading.toFixed(1)}°
          </div>
          {isLocationTracking && (
            <div className="text-xs text-green-200 mt-1">🔄 Live tracking</div>
          )}
        </div>

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

        {/* Checkpoints status */}
        <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg">
          <div className="font-bold mb-1 flex items-center gap-2">
            📍 Checkpoints
            {checkpointsLoading && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            )}
          </div>
          <div className="text-xs">
            {checkpointsLoading ? (
              <span className="text-green-200">Loading from blockchain...</span>
            ) : (
              <>
                <span className="font-mono">{checkpointCoordinates.length} pins loaded</span>
                <br />
                <span className="text-green-200">🗺️ Rendered on map</span>
              </>
            )}
          </div>
        </div>

        {/* Camera view tracking */}
        <div className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg">
          <div className="font-bold mb-1">🎥 Camera View</div>
          <div className="font-mono text-xs">
            Tilt: {cameraView.tilt.toFixed(1)}°<br />
            Heading: {cameraView.heading.toFixed(1)}°<br />
            Zoom: {cameraView.zoom.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}