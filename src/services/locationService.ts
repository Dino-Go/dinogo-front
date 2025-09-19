export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
}

export class LocationService {
  private watchId: number | null = null;
  private currentLocation: UserLocation | null = null;
  private callbacks: Set<(location: UserLocation) => void> = new Set();

  constructor() {
    this.initializeLocation();
  }

  private async initializeLocation() {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      this.updateLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading || undefined,
      });

      this.startWatching();
    } catch (error) {
      console.error('Error getting initial location:', error);
    }
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    });
  }

  private startWatching() {
    if (this.watchId !== null) {
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.updateLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
        });
      },
      (error) => {
        console.error('Error watching location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 30000,
      }
    );
  }

  private updateLocation(location: UserLocation) {
    this.currentLocation = location;
    this.callbacks.forEach(callback => callback(location));
  }

  public getCurrentLocation(): UserLocation | null {
    return this.currentLocation;
  }

  public onLocationUpdate(callback: (location: UserLocation) => void): () => void {
    this.callbacks.add(callback);

    if (this.currentLocation) {
      callback(this.currentLocation);
    }

    return () => {
      this.callbacks.delete(callback);
    };
  }

  public stopWatching() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  public async requestPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!navigator.permissions) {
      return 'prompt';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch {
      return 'prompt';
    }
  }
}

export const locationService = new LocationService();