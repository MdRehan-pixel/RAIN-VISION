import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { CityWeather, LocationState, SpatialPoint } from "@/lib/types";
import { calculateRisk, categoryForScore } from "@/lib/risk";
import { makeFallbackForecast, formatNumber } from "@/lib/weather";
import type { ForecastEnvelope } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center, map]);
  return null;
}

function ClickHandler({ onSelect }: { onSelect: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return null;
}

const cityScore = (city: CityWeather) => {
  const current = city.current;
  const pseudo = makeFallbackForecast(city.latitude, city.longitude);
  const forecast: ForecastEnvelope = { ...pseudo, status: "LIVE", data: { ...pseudo.data, current } };
  return calculateRisk(forecast).score;
};

export default function LeafletMap({ location, radiusKm, spatial, cities, onSelect, large = false, hudLabel = "Selected coordinates" }: { location: LocationState; radiusKm: number; spatial: SpatialPoint[]; cities: CityWeather[]; onSelect: (latitude: number, longitude: number) => void; large?: boolean; hudLabel?: string }) {
  const center: [number, number] = [location.latitude, location.longitude];
  return <div data-testid="risk-map" className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm ${large ? "h-[calc(100vh-220px)] min-h-[520px]" : "h-[390px]"}`}>
    <MapContainer center={center} zoom={large ? 6 : 10} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter center={center} />
      <ClickHandler onSelect={onSelect} />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: "#0284c7", fillColor: "#38bdf8", fillOpacity: 0.08, weight: 2, dashArray: "6 6" }} />
      <CircleMarker center={center} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#1d4ed8", fillOpacity: 1 }}><div /></CircleMarker>
      {spatial.map((point) => <CircleMarker key={point.name} center={[point.latitude, point.longitude]} radius={point.name === "CENTER" ? 7 : 6} pathOptions={{ color: "#fff", weight: 2, fillColor: point.name === "CENTER" ? "#1d4ed8" : "#f59e0b", fillOpacity: 0.88 }} />)}
      {cities.map((city) => { const score = cityScore(city); return <CircleMarker key={city.name} center={[city.latitude, city.longitude]} radius={large ? 7 : 5} pathOptions={{ color: "#fff", weight: 1.5, fillColor: score >= 70 ? "#dc2626" : score >= 50 ? "#ea580c" : score >= 30 ? "#d97706" : "#059669", fillOpacity: 0.9 }}><div /></CircleMarker>; })}
    </MapContainer>
    <div data-testid="map-coordinates-hud" className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-white/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{hudLabel}</p><p className="mt-1 font-mono text-xs text-slate-900">{formatNumber(location.latitude, 4)}° N · {formatNumber(location.longitude, 4)}° E</p></div>
    <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-right shadow-lg backdrop-blur"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Monitoring radius</p><p className="mt-1 text-sm font-semibold text-slate-900">{radiusKm} km</p></div>
  </div>;
}