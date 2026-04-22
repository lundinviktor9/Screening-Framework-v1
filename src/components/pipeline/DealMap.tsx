import { useState } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { type DealRecord } from '../../store/useDealStore';
import { useMarketStore } from '../../store/marketStore';

interface DealMapProps {
  deals: DealRecord[];
  selectedDeal: DealRecord | null;
}

interface MapMarker {
  deal: DealRecord;
  lat: number;
  lng: number;
}

export function DealMap({ deals, selectedDeal }: DealMapProps) {
  const [popupDeal, setPopupDeal] = useState<DealRecord | null>(null);
  const markets = useMarketStore(s => s.markets);

  // Get coordinates for deals
  const markers: MapMarker[] = deals
    .map(deal => {
      if (!deal.market_ids.length) return null;

      // Get first market's coordinates
      const market = markets.find(m => m.id === deal.market_ids[0]);
      if (!market) return null;

      return {
        deal,
        lat: market.lat,
        lng: market.lng
      };
    })
    .filter((m): m is MapMarker => m !== null);

  // Center on selected deal or UK average
  const centerLat = selectedDeal?.market_ids.length
    ? markets.find(m => m.id === selectedDeal.market_ids[0])?.lat ?? 54
    : 54;
  const centerLng = selectedDeal?.market_ids.length
    ? markets.find(m => m.id === selectedDeal.market_ids[0])?.lng ?? -2
    : -2;

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-700 font-medium">Mapbox token not configured</p>
          <p className="text-xs text-gray-500 mt-1">Add VITE_MAPBOX_TOKEN to .env.local</p>
        </div>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        latitude: centerLat,
        longitude: centerLng,
        zoom: 6
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {markers.map(marker => {
        const isSelected = selectedDeal?.deal_id === marker.deal.deal_id;
        const fitScore = marker.deal.microlocation_fit_score;
        const color =
          fitScore >= 70 ? '#16a34a' : fitScore >= 50 ? '#eab308' : '#dc2626';

        return (
          <Marker
            key={marker.deal.deal_id}
            latitude={marker.lat}
            longitude={marker.lng}
            onClick={() => setPopupDeal(marker.deal)}
          >
            <div
              className={`w-8 h-8 rounded-full cursor-pointer transition-transform ${
                isSelected ? 'scale-125 ring-2 ring-offset-2' : ''
              }`}
              style={{
                backgroundColor: color,
                opacity: isSelected ? 1 : 0.8,
                ringColor: color
              }}
              title={marker.deal.extracted_fields?.['Project Name']}
            />
          </Marker>
        );
      })}

      {popupDeal && (
        <Popup
          latitude={
            markers.find(m => m.deal.deal_id === popupDeal.deal_id)?.lat ?? 54
          }
          longitude={
            markers.find(m => m.deal.deal_id === popupDeal.deal_id)?.lng ?? -2
          }
          onClose={() => setPopupDeal(null)}
          closeButton
          closeOnClick={false}
        >
          <div className="p-2">
            <div className="font-medium text-sm">
              {popupDeal.extracted_fields?.['Project Name']}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              NIY: {popupDeal.extracted_fields?.Yield?.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-600">
              Fit: {popupDeal.microlocation_fit_score.toFixed(0)}
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
