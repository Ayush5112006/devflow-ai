import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import type { Asset } from '../../types';
import { RiskMarker } from './RiskMarker';

// Fix broken Leaflet default icon — use bundled assets to avoid external CDN requests
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
});

interface GridMapProps {
  assets: Asset[];
  selectedAssetId?: string | null;
  onAssetSelect?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  height?: string | number;
}

function MapInitializer({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export function GridMap({
  assets,
  selectedAssetId,
  onAssetSelect,
  center = [41.87, -87.65],
  zoom = 11,
  height = '100%',
}: GridMapProps) {
  return (
    <div
      style={{ height }}
      className="rounded-xl overflow-hidden border border-surface-border"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        zoomControl
      >
        <MapInitializer center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {assets.map((asset) => (
          <RiskMarker
            key={asset.id}
            asset={asset}
            isSelected={asset.id === selectedAssetId}
            onClick={onAssetSelect}
          />
        ))}
      </MapContainer>
    </div>
  );
}
