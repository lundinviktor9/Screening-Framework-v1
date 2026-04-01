import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import type { ScoredMarket } from '../../types';
import { MARKET_CENTROIDS } from '../../data/marketCentroids';

interface Props {
  markets: ScoredMarket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function tierColor(score: number): string {
  if (score >= 80) return '#15803d';
  if (score >= 60) return '#b45309';
  return '#b91c1c';
}

function tierFill(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

export default function MarketMap({ markets, selectedId, onSelect }: Props) {
  return (
    <MapContainer
      center={[54.5, -3.0]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {markets.map((sm) => {
        const coords = MARKET_CENTROIDS[sm.market.id];
        if (!coords) return null;

        const isSelected = sm.market.id === selectedId;
        const color = tierColor(sm.totalScore);
        const fill  = tierFill(sm.totalScore);

        return (
          <CircleMarker
            key={sm.market.id}
            center={coords}
            radius={isSelected ? 12 : 8}
            pathOptions={{
              color: isSelected ? '#3B1F6B' : color,
              fillColor: fill,
              fillOpacity: isSelected ? 1 : 0.75,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(sm.market.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <span className="font-semibold">{sm.market.name}</span>
              <br />
              Score: <strong>{sm.totalScore}</strong> &nbsp;·&nbsp; Rank #{sm.rank}
              <br />
              {sm.market.region}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
