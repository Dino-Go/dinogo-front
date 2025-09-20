import type { Location, LocationWithAccuracy } from '@/types/location';

/**
 * Calculate the distance between two geographic points using the Haversine formula
 * @param point1 First geographic point
 * @param point2 Second geographic point
 * @returns Distance in meters
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate the bearing (direction) from one point to another
 * @param point1 Starting point
 * @param point2 Destination point
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(point1: Location, point2: Location): number {
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Calculate speed between two location points
 * @param from Previous location with timestamp
 * @param to Current location with timestamp
 * @returns Speed in meters per second
 */
export function calculateSpeed(from: LocationWithAccuracy, to: LocationWithAccuracy): number {
  const distance = calculateDistance(from, to);
  const timeDiff = (to.timestamp - from.timestamp) / 1000; // Convert to seconds

  if (timeDiff <= 0) return 0;
  return distance / timeDiff;
}

/**
 * Interpolate between two geographic points
 * @param point1 Starting point
 * @param point2 Ending point
 * @param ratio Interpolation ratio (0-1)
 * @returns Interpolated point
 */
export function interpolateLocation(point1: Location, point2: Location, ratio: number): Location {
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  return {
    lat: point1.lat + (point2.lat - point1.lat) * clampedRatio,
    lng: point1.lng + (point2.lng - point1.lng) * clampedRatio,
    altitude: point1.altitude && point2.altitude
      ? point1.altitude + (point2.altitude - point1.altitude) * clampedRatio
      : point1.altitude || point2.altitude
  };
}

/**
 * Check if a location reading is accurate enough to use
 * @param location Location reading with accuracy
 * @param maxAccuracy Maximum allowed accuracy in meters
 * @returns True if location is accurate enough
 */
export function isLocationAccurate(location: LocationWithAccuracy, maxAccuracy: number = 100): boolean {
  return location.accuracy <= maxAccuracy;
}

/**
 * Check if user has moved significantly since last position
 * @param from Previous location
 * @param to Current location
 * @param threshold Minimum distance threshold in meters
 * @returns True if movement is significant
 */
export function hasSignificantMovement(
  from: LocationWithAccuracy,
  to: LocationWithAccuracy,
  threshold: number = 5
): boolean {
  // Use fast calculation with early termination for mobile performance
  const distance = calculateDistanceFast(from, to, threshold * 2);

  // If fast calculation says it's too far, use full calculation
  if (distance === -1) {
    return calculateDistance(from, to) >= threshold;
  }

  return distance >= threshold;
}

/**
 * Convert location to Google Maps LatLng format
 * @param location Location object
 * @returns Google Maps compatible object
 */
export function toGoogleMapsLatLng(location: Location): google.maps.LatLngLiteral {
  return {
    lat: location.lat,
    lng: location.lng
  };
}

/**
 * Convert location to Three.js overlay anchor format
 * @param location Location object
 * @returns Three.js overlay anchor object
 */
export function toThreeJSAnchor(location: Location): { lat: number; lng: number; altitude: number } {
  return {
    lat: location.lat,
    lng: location.lng,
    altitude: location.altitude || 0
  };
}

/**
 * Format location for display
 * @param location Location object
 * @param precision Number of decimal places
 * @returns Formatted location string
 */
export function formatLocation(location: Location, precision: number = 6): string {
  return `${location.lat.toFixed(precision)}, ${location.lng.toFixed(precision)}`;
}

/**
 * Calculate average speed over multiple readings
 * @param locations Array of location readings with timestamps
 * @returns Average speed in meters per second
 */
export function calculateAverageSpeed(locations: LocationWithAccuracy[]): number {
  if (locations.length < 2) return 0;

  let totalDistance = 0;
  let totalTime = 0;

  for (let i = 1; i < locations.length; i++) {
    const distance = calculateDistance(locations[i - 1], locations[i]);
    const timeDiff = (locations[i].timestamp - locations[i - 1].timestamp) / 1000;

    totalDistance += distance;
    totalTime += timeDiff;
  }

  return totalTime > 0 ? totalDistance / totalTime : 0;
}

/**
 * Smooth location readings using simple moving average
 * @param locations Array of recent location readings
 * @param windowSize Number of readings to average
 * @returns Smoothed location
 */
export function smoothLocation(locations: LocationWithAccuracy[], windowSize: number = 3): LocationWithAccuracy | null {
  if (locations.length === 0) return null;
  if (locations.length < windowSize) return locations[locations.length - 1];

  const recentLocations = locations.slice(-windowSize);

  // Weighted average favoring more recent readings for mobile responsiveness
  let totalWeight = 0;
  let weightedLat = 0;
  let weightedLng = 0;
  let weightedAccuracy = 0;

  recentLocations.forEach((loc, index) => {
    // More weight to recent readings (exponential decay)
    const weight = Math.pow(2, index);
    totalWeight += weight;
    weightedLat += loc.lat * weight;
    weightedLng += loc.lng * weight;
    weightedAccuracy += loc.accuracy * weight;
  });

  const latest = recentLocations[recentLocations.length - 1];

  return {
    ...latest,
    lat: weightedLat / totalWeight,
    lng: weightedLng / totalWeight,
    accuracy: weightedAccuracy / totalWeight
  };
}

/**
 * Mobile-optimized distance calculation with early termination
 * @param point1 First geographic point
 * @param point2 Second geographic point
 * @param maxDistance Maximum distance to calculate (returns early if exceeded)
 * @returns Distance in meters or -1 if exceeds maxDistance
 */
export function calculateDistanceFast(point1: Location, point2: Location, maxDistance?: number): number {
  // Quick approximation check first (faster than full Haversine)
  const latDiff = Math.abs(point2.lat - point1.lat);
  const lngDiff = Math.abs(point2.lng - point1.lng);

  // Rough approximation: 1 degree ≈ 111km at equator
  const roughDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;

  // Early termination if clearly exceeds max distance
  if (maxDistance && roughDistance > maxDistance * 1.5) {
    return -1;
  }

  // Full calculation if within reasonable bounds
  return calculateDistance(point1, point2);
}

/**
 * Check if device is mobile for performance optimizations
 */
export function isMobileDevice(): boolean {
  return typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     'ontouchstart' in window);
}

/**
 * Get mobile-optimized geolocation options
 */
export function getMobileGeolocationOptions(): PositionOptions {
  const isMobile = isMobileDevice();

  return {
    enableHighAccuracy: true,
    timeout: isMobile ? 15000 : 10000,
    maximumAge: isMobile ? 90000 : 60000
  };
}