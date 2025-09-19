declare module '@googlemaps/three' {
  export class ThreeJSOverlayView {
    constructor(options: {
      map: google.maps.Map;
      scene: any;
      anchor: { lat: number; lng: number; altitude: number };
      THREE: any;
    });
    requestRedraw(): void;
  }
}