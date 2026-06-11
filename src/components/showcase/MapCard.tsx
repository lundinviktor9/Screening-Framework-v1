import { useEffect, useRef } from 'react';

interface MapCardProps {
  location?: { address?: string; postcode?: string; lat?: number; lng?: number } | null;
  onLocationChange?: (lat: number, lng: number) => void;
}

export function MapCard({ location, onLocationChange }: MapCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !location?.lat || !location?.lng) return;

    // Lazy-load Mapbox
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) {
      containerRef.current.innerHTML = '<div class="p-4 text-sm text-gray-600">Map TBC</div>';
      return;
    }

    try {
      const mapboxToken = (process.env.MAPBOX_TOKEN as string) || '';
      if (!mapboxToken) {
        containerRef.current.innerHTML = '<div class="p-4 text-sm text-gray-600">Map TBC (no token)</div>';
        return;
      }

      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [location.lng, location.lat],
        zoom: 14,
        scrollZoom: false,
      });

      // Add draggable marker
      const marker = new mapboxgl.Marker({ draggable: true, color: '#7D5A7D' })
        .setLngLat([location.lng, location.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onLocationChange?.(lngLat.lat, lngLat.lng);
      });

      return () => map.remove();
    } catch (e) {
      containerRef.current.innerHTML = '<div class="p-4 text-sm text-gray-600">Map TBC</div>';
    }
  }, [location?.lat, location?.lng]);

  if (!location?.lat || !location?.lng) {
    return (
      <div className="h-64 bg-brand-cardBg rounded-lg flex items-center justify-center">
        <span className="text-sm text-gray-600">Location TBC</span>
      </div>
    );
  }

  return <div ref={containerRef} className="h-64 rounded-lg border border-gray-200 overflow-hidden" />;
}
