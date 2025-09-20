'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { LocationTrackingState, LocationTrackingOptions, LocationWithAccuracy, MovementUpdate } from '@/types/location';
import {
  calculateDistance,
  calculateBearing,
  calculateSpeed,
  hasSignificantMovement,
  isLocationAccurate,
  smoothLocation
} from '@/utils/geoUtils';

import { isMobileDevice } from '@/utils/geoUtils';

// Mobile-optimized defaults for better battery life
const isMobile = isMobileDevice();

const DEFAULT_OPTIONS: Required<LocationTrackingOptions> = {
  enableHighAccuracy: true,
  timeout: isMobile ? 15000 : 10000, // Longer timeout on mobile
  maximumAge: isMobile ? 90000 : 60000, // Allow older readings on mobile
  minDistanceThreshold: isMobile ? 5 : 3, // Less sensitive on mobile to save battery
  updateThrottle: isMobile ? 3000 : 2000, // Slower updates on mobile
  maxAccuracy: isMobile ? 100 : 50 // More lenient accuracy on mobile
};

interface UseLocationTrackingResult {
  state: LocationTrackingState;
  startWatching: () => void;
  stopWatching: () => void;
  requestLocation: () => Promise<LocationWithAccuracy>;
  getCurrentPosition: () => LocationWithAccuracy | null;
  isFollowingEnabled: boolean;
  toggleFollowing: () => void;
  getMovementUpdate: () => MovementUpdate | null;
}

export function useLocationTracking(options: LocationTrackingOptions = {}): UseLocationTrackingResult {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [
    options.enableHighAccuracy,
    options.timeout,
    options.maximumAge,
    options.minDistanceThreshold,
    options.updateThrottle,
    options.maxAccuracy
  ]);

  const [state, setState] = useState<LocationTrackingState>({
    currentLocation: null,
    previousLocation: null,
    isWatching: false,
    permission: 'prompt',
    error: null,
    watchId: null,
    lastUpdate: 0,
    totalDistance: 0,
    averageSpeed: 0
  });

  const [isFollowingEnabled, setIsFollowingEnabled] = useState(true);
  const lastUpdateRef = useRef<number>(0);
  const locationHistoryRef = useRef<LocationWithAccuracy[]>([]);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Check if geolocation is supported
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // Mobile performance optimization: reduce processing frequency
  const lastProcessTime = useRef<number>(0);
  const MOBILE_PROCESS_THROTTLE = 1000; // Minimum 1 second between processing on mobile

  // Process new location reading
  const processLocationUpdate = useCallback((position: GeolocationPosition) => {
    const now = Date.now();

    // Additional throttling for mobile devices
    if (isMobile && now - lastProcessTime.current < MOBILE_PROCESS_THROTTLE) {
      return;
    }
    lastProcessTime.current = now;

    const newLocation: LocationWithAccuracy = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      altitude: position.coords.altitude || undefined,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
      heading: position.coords.heading || undefined,
      speed: position.coords.speed || undefined,
      timestamp: now
    };

    // Check if location is accurate enough
    if (!isLocationAccurate(newLocation, opts.maxAccuracy)) {
      console.log('Location accuracy too low:', newLocation.accuracy, 'meters');
      return;
    }

    // Throttle updates
    if (now - lastUpdateRef.current < opts.updateThrottle) {
      return;
    }

    setState(prevState => {
      // Check if this is a significant movement
      if (prevState.currentLocation &&
          !hasSignificantMovement(prevState.currentLocation, newLocation, opts.minDistanceThreshold)) {
        return prevState; // No significant movement, don't update
      }

      // Add to location history for smoothing (smaller history on mobile)
      locationHistoryRef.current.push(newLocation);
      const maxHistory = isMobile ? 3 : 5;
      if (locationHistoryRef.current.length > maxHistory) {
        locationHistoryRef.current.shift();
      }

      // Smooth the location reading (less smoothing on mobile for responsiveness)
      const smoothWindow = isMobile ? 2 : 3;
      const smoothedLocation = smoothLocation(locationHistoryRef.current, smoothWindow) || newLocation;

      // Calculate distance and speed if we have a previous location
      let newTotalDistance = prevState.totalDistance;
      let newAverageSpeed = prevState.averageSpeed;

      if (prevState.currentLocation) {
        const distance = calculateDistance(prevState.currentLocation, smoothedLocation);
        newTotalDistance += distance;

        const speed = calculateSpeed(prevState.currentLocation, smoothedLocation);
        newAverageSpeed = prevState.averageSpeed === 0 ? speed : (prevState.averageSpeed + speed) / 2;
      }

      lastUpdateRef.current = now;

      return {
        ...prevState,
        previousLocation: prevState.currentLocation,
        currentLocation: smoothedLocation,
        error: null,
        lastUpdate: now,
        totalDistance: newTotalDistance,
        averageSpeed: newAverageSpeed
      };
    });
  }, [opts.maxAccuracy, opts.minDistanceThreshold, opts.updateThrottle]);

  // Handle geolocation errors
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Unknown location error';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        setState(prev => ({ ...prev, permission: 'denied' }));
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }

    console.error('Geolocation error:', errorMessage);
    setState(prev => ({
      ...prev,
      error: errorMessage,
      isWatching: false,
      watchId: null
    }));
  }, []);

  // Start watching user location
  const startWatching = useCallback(() => {
    if (!isSupported) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    if (state.isWatching) {
      return; // Already watching
    }

    const watchId = navigator.geolocation.watchPosition(
      processLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge
      }
    );

    watchIdRef.current = watchId;
    setState(prev => ({
      ...prev,
      isWatching: true,
      watchId,
      permission: 'granted',
      error: null
    }));
  }, [isSupported, state.isWatching, processLocationUpdate, handleLocationError, opts]);

  // Stop watching user location
  const stopWatching = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isWatching: false,
      watchId: null
    }));
  }, []);

  // Get current position once
  const requestLocation = useCallback((): Promise<LocationWithAccuracy> => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationWithAccuracy = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: Date.now()
          };

          setState(prev => ({
            ...prev,
            currentLocation: location,
            permission: 'granted',
            error: null
          }));

          resolve(location);
        },
        (error) => {
          handleLocationError(error);
          reject(error);
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge
        }
      );
    });
  }, [isSupported, handleLocationError, opts]);

  // Get current position
  const getCurrentPosition = useCallback(() => {
    return state.currentLocation;
  }, [state.currentLocation]);

  // Toggle following mode
  const toggleFollowing = useCallback(() => {
    setIsFollowingEnabled(prev => {
      const newValue = !prev;
      if (newValue && !state.isWatching) {
        startWatching();
      } else if (!newValue && state.isWatching) {
        stopWatching();
      }
      return newValue;
    });
  }, [state.isWatching, startWatching, stopWatching]);

  // Get movement update information
  const getMovementUpdate = useCallback((): MovementUpdate | null => {
    if (!state.currentLocation || !state.previousLocation) {
      return null;
    }

    const distance = calculateDistance(state.previousLocation, state.currentLocation);
    const bearing = calculateBearing(state.previousLocation, state.currentLocation);
    const speed = calculateSpeed(state.previousLocation, state.currentLocation);
    const duration = state.currentLocation.timestamp - state.previousLocation.timestamp;

    return {
      from: state.previousLocation,
      to: state.currentLocation,
      distance,
      bearing,
      speed,
      duration
    };
  }, [state.currentLocation, state.previousLocation]);

  // Auto start watching when following is enabled
  useEffect(() => {
    if (isFollowingEnabled && !state.isWatching && state.permission !== 'denied') {
      startWatching();
    }
  }, [isFollowingEnabled, state.isWatching, state.permission, startWatching]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  return {
    state,
    startWatching,
    stopWatching,
    requestLocation,
    getCurrentPosition,
    isFollowingEnabled,
    toggleFollowing,
    getMovementUpdate
  };
}