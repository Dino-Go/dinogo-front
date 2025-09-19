declare global {
  interface Window {
    google: any;
  }

  namespace google {
    namespace maps {
      interface MapOptions {
        center?: { lat: number; lng: number };
        zoom?: number;
        tilt?: number;
        heading?: number;
        mapId?: string;
        disableDefaultUI?: boolean;
        gestureHandling?: string;
        zoomControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
      }

      class Map {
        constructor(element: HTMLElement, options: MapOptions);
        addListener(eventName: string, handler: () => void): void;
        setCenter(latLng: { lat: number; lng: number }): void;
        setZoom(zoom: number): void;
      }

      class Marker {
        constructor(opts: {
          position: { lat: number; lng: number };
          map: Map;
          title?: string;
          icon?: any;
        });
      }

      enum SymbolPath {
        CIRCLE = 0,
        FORWARD_CLOSED_ARROW = 1,
        FORWARD_OPEN_ARROW = 2,
        BACKWARD_CLOSED_ARROW = 3,
        BACKWARD_OPEN_ARROW = 4
      }
    }
  }
}

export {};