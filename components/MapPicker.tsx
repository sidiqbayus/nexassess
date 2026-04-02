'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Memperbaiki masalah icon Leaflet bawaan yang hilang di Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  radius: number;
  onChange: (lat: number, lng: number) => void;
}

// Komponen agar peta bisa diklik
function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

// Komponen agar peta otomatis geser saat tombol "Titik Saat Ini" diklik
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 17, { animate: true });
  }, [center, map]);
  return null;
}

export default function MapPicker({ lat, lng, radius, onChange }: MapPickerProps) {
  // Titik tengah default jika belum ada koordinat (Misal: Monas, Jakarta)
  const defaultCenter: [number, number] = [-6.175392, 106.827153];
  const center: [number, number] = lat && lng ? [lat, lng] : defaultCenter;

  return (
    <div className="h-[300px] w-full rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner relative z-0 mt-4">
      <MapContainer center={center} zoom={lat && lng ? 17 : 5} scrollWheelZoom={true} className="h-full w-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} />
        {lat && lng && <MapUpdater center={[lat, lng]} />}
        
        {lat && lng && (
          <>
            <Marker 
              position={[lat, lng]} 
              icon={customIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onChange(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
                },
              }}
            />
            {/* Lingkaran hijau untuk visualisasi Radius GPS */}
            <Circle 
              center={[lat, lng]} 
              radius={radius} 
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2 }} 
            />
          </>
        )}
      </MapContainer>
      
      {/* Petunjuk UI */}
      <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm border border-slate-200 pointer-events-none">
        Bisa digeser (Drag) atau Klik Peta
      </div>
    </div>
  );
}