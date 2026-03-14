"use client";

import { MapContainer, TileLayer, Polyline, Popup, CircleMarker, Marker } from "react-leaflet";
import L from "leaflet";
import type { TrafficState, Incident } from "@/lib/types";
import { ALL_SEGMENTS, INCIDENT_ICONS, ROUTE_CONFIG, KM48_COORDS, KM48_LABEL, AREQUIPA_CENTER } from "@/lib/roads";
import { CONGESTION_COLORS, CONGESTION_LABELS, ROUTE_COLORS } from "@/lib/colors";
import { formatMinutes } from "@/lib/traffic";

interface Props {
  states: TrafficState[];
  incidents: Incident[];
}

// Center the map between Arequipa and Km 48
const MAP_CENTER: [number, number] = [-16.47, -71.67];

function createEmojiIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="font-size:20px;text-align:center;line-height:1">${emoji}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const arequipaIcon = L.divIcon({
  html: `<div style="font-size:16px;text-align:center;line-height:1;background:#16213E;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid #E94560;box-shadow:0 2px 8px rgba(233,69,96,0.4)">🏛️</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const km48Icon = L.divIcon({
  html: `<div style="font-size:14px;text-align:center;line-height:1;background:#16213E;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid #00E396;box-shadow:0 2px 8px rgba(0,227,150,0.4)">📍</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function pickWorstState(a?: TrafficState, b?: TrafficState): TrafficState | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.congestionRatio >= b.congestionRatio ? a : b;
}

export default function TrafficMapInner({ states, incidents }: Props) {
  // Key states by segmentId:direction
  const stateMap = new Map<string, TrafficState>();
  states.forEach((s) => {
    stateMap.set(`${s.segmentId}:${s.direction}`, s);
  });

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={11}
      className="h-full w-full rounded-xl"
      zoomControl={false}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Arequipa marker */}
      <Marker position={AREQUIPA_CENTER} icon={arequipaIcon}>
        <Popup>
          <div className="text-sm font-bold">Arequipa</div>
          <div className="text-xs text-gray-500">Sachaca / Inicio corredor</div>
        </Popup>
      </Marker>

      {/* Km 48 marker */}
      <Marker position={KM48_COORDS} icon={km48Icon}>
        <Popup>
          <div className="text-sm font-bold">{KM48_LABEL}</div>
          <div className="text-xs text-gray-500">Punto de confluencia</div>
        </Popup>
      </Marker>

      {/* Road segments */}
      {ALL_SEGMENTS.map((segment) => {
        const config = ROUTE_CONFIG[segment.routeId];
        const positions = segment.polyline.map(
          ([lat, lng]) => [lat, lng] as [number, number]
        );

        // ── Color by worst direction ──
        const salidaState = stateMap.get(`${segment.id}:salida`);
        const ingresoState = stateMap.get(`${segment.id}:ingreso`);
        const worstState = pickWorstState(salidaState, ingresoState);
        const color = worstState
          ? CONGESTION_COLORS[worstState.congestionLevel]
          : ROUTE_COLORS[segment.routeId];

        return (
          <Polyline
            key={segment.id}
            positions={positions}
            pathOptions={{
              color,
              weight: 6,
              opacity: 0.85,
              lineJoin: "round",
              lineCap: "round",
            }}
          >
            <Popup>
              <div className="text-sm min-w-[200px]">
                <p className="font-bold mb-2">{segment.name}</p>
                <p className="text-[10px] text-gray-400 mb-1">{segment.distanceKm} km</p>
                {salidaState && (
                  <div className="mb-1.5 pb-1.5 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 mb-0.5">Salida →</p>
                    <div className="flex justify-between text-xs">
                      <span
                        style={{ color: CONGESTION_COLORS[salidaState.congestionLevel] }}
                        className="font-semibold"
                      >
                        {CONGESTION_LABELS[salidaState.congestionLevel]}
                      </span>
                      <span>{salidaState.currentSpeedKmh} km/h</span>
                      <span className="font-semibold">
                        {formatMinutes(salidaState.estimatedMinutes)}
                      </span>
                    </div>
                  </div>
                )}
                {ingresoState && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-0.5">← Ingreso</p>
                    <div className="flex justify-between text-xs">
                      <span
                        style={{ color: CONGESTION_COLORS[ingresoState.congestionLevel] }}
                        className="font-semibold"
                      >
                        {CONGESTION_LABELS[ingresoState.congestionLevel]}
                      </span>
                      <span>{ingresoState.currentSpeedKmh} km/h</span>
                      <span className="font-semibold">
                        {formatMinutes(ingresoState.estimatedMinutes)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Segment boundary markers */}
      {ALL_SEGMENTS.map((segment) => (
          <CircleMarker
            key={`marker-${segment.id}`}
            center={segment.startCoords}
            radius={3}
            pathOptions={{
              fillColor: "#ffffff",
              fillOpacity: 0.9,
              color: "#1D3557",
              weight: 1.5,
            }}
          />
        ))}

      {/* Incident markers */}
      {incidents
        .filter((i) => i.active)
        .map((incident) => (
          <Marker
            key={incident.id}
            position={incident.coords}
            icon={createEmojiIcon(INCIDENT_ICONS[incident.type] || "⚠️")}
          >
            <Popup>
              <div className="text-sm min-w-[200px]">
                <p className="font-bold mb-1">
                  {INCIDENT_ICONS[incident.type]} {incident.title}
                </p>
                <p className="text-xs text-gray-600 mb-1">
                  {incident.description}
                </p>
                <p className="text-xs text-gray-400">
                  Reportado por {incident.reportedBy}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
