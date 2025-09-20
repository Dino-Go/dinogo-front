export interface Location {
  lat: number;
  lng: number;
  altitude?: number;
}

export interface LocationWithAccuracy extends Location {
  accuracy: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface LocationTrackingState {
  currentLocation: LocationWithAccuracy | null;
  previousLocation: LocationWithAccuracy | null;
  isWatching: boolean;
  permission: 'prompt' | 'granted' | 'denied';
  error: string | null;
  watchId: number | null;
  lastUpdate: number;
  totalDistance: number;
  averageSpeed: number;
}

export interface LocationTrackingOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  minDistanceThreshold?: number; // meters
  updateThrottle?: number; // milliseconds
  maxAccuracy?: number; // meters - ignore readings with worse accuracy
}

export interface MovementUpdate {
  from: LocationWithAccuracy;
  to: LocationWithAccuracy;
  distance: number;
  bearing: number;
  speed: number;
  duration: number;
}

export type LocationTrackingStatus = 'idle' | 'requesting' | 'watching' | 'error';

export interface LocationPermissionState {
  status: PermissionState;
  canRequest: boolean;
  isSupported: boolean;
}