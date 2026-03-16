"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Popup,
  Marker,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import { decode } from "@googlemaps/polyline-codec";
import type { TrafficState, Incident, RoutePolyline, SpeedCategory, RouteId, Direction } from "@/lib/types";
import {
  ALL_SEGMENTS,
  INCIDENT_ICONS,
  KM48_COORDS,
  KM48_LABEL,
  AREQUIPA_CENTER,
  UCHUMAYO_PATH,
  CERRO_VERDE_PATH,
} from "@/lib/roads";
import {
  CONGESTION_COLORS,
  CONGESTION_LABELS,
  ROUTE_COLORS,
} from "@/lib/colors";
import { formatMinutes } from "@/lib/traffic";

interface Props {
  states: TrafficState[];
  incidents: Incident[];
  polylines: RoutePolyline[];
  direction: Direction;
}

const MAP_CENTER: [number, number] = [-16.47, -71.67];

const SPEED_COLORS: Record<SpeedCategory, string> = {
  NORMAL: "#10b981",
  SLOW: "#f59e0b",
  TRAFFIC_JAM: "#dc2626",
};

const incidentIcon = L.divIcon({
  html: `<div style="font-size:14px;text-align:center;line-height:1;background:#0f172a;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:2px solid #f43f5e;box-shadow:0 2px 8px rgba(244,63,94,0.5)">⚠️</div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const arequipaIcon = L.divIcon({
  html: `<div style="font-size:16px;text-align:center;line-height:1;background:#0f172a;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid #3b82f6;box-shadow:0 2px 8px rgba(59,130,246,0.4)">🏛️</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const km48Icon = L.divIcon({
  html: `<div style="font-size:14px;text-align:center;line-height:1;background:#0f172a;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid #10b981;box-shadow:0 2px 8px rgba(16,185,129,0.4)">📍</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function pickWorstState(
  a?: TrafficState,
  b?: TrafficState
): TrafficState | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.congestionRatio >= b.congestionRatio ? a : b;
}

interface DecodedInterval {
  positions: [number, number][];
  color: string;
  routeId: RouteId;
  direction: string;
}

function buildSpeedSegments(polylines: RoutePolyline[]): DecodedInterval[] {
  const segments: DecodedInterval[] = [];

  for (const rp of polylines) {
    const decoded = decode(rp.encodedPolyline, 5) as [number, number][];
    for (const interval of rp.speedIntervals) {
      const start = interval.startPolylinePointIndex;
      const end = interval.endPolylinePointIndex;
      if (end <= start || start >= decoded.length) continue;

      const slice = decoded.slice(start, Math.min(end + 1, decoded.length));
      if (slice.length < 2) continue;

      segments.push({
        positions: slice,
        color: SPEED_COLORS[interval.speed],
        routeId: rp.routeId,
        direction: rp.direction,
      });
    }
  }

  return segments;
}

function StaticSegmentsFallback({ states }: { states: TrafficState[] }) {
  const stateMap = new Map<string, TrafficState>();
  states.forEach((s) => stateMap.set(`${s.segmentId}:${s.direction}`, s));

  return (
    <>
      {ALL_SEGMENTS.map((segment) => {
        const positions = segment.polyline.map(
          ([lat, lng]) => [lat, lng] as [number, number]
        );
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
                <p className="font-bold mb-2 text-slate-100">{segment.name}</p>
                {salidaState && (
                  <div className="mb-1.5 pb-1.5 border-b border-slate-700">
                    <p className="text-xs font-semibold text-slate-300 mb-0.5">
                      Salida
                    </p>
                    <div className="flex justify-between text-xs text-slate-200">
                      <span
                        style={{
                          color:
                            CONGESTION_COLORS[salidaState.congestionLevel],
                        }}
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
                    <p className="text-xs font-semibold text-slate-300 mb-0.5">
                      Ingreso
                    </p>
                    <div className="flex justify-between text-xs text-slate-200">
                      <span
                        style={{
                          color:
                            CONGESTION_COLORS[ingresoState.congestionLevel],
                        }}
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
    </>
  );
}

const STATIC_PATHS: Record<RouteId, [number, number][]> = {
  uchumayo: UCHUMAYO_PATH,
  "cerro-verde": CERRO_VERDE_PATH,
};

// ~330m threshold in degrees for "same road" proximity
const PROXIMITY_THRESHOLD_SQ = 0.003 * 0.003;

function findUncoveredSegments(
  staticPath: [number, number][],
  googlePolyline: [number, number][]
): [number, number][][] {
  const result: [number, number][][] = [];
  let current: [number, number][] = [];
  let lastCoveredPoint: [number, number] | null = null;

  for (const point of staticPath) {
    let covered = false;
    for (const gp of googlePolyline) {
      const dlat = point[0] - gp[0];
      const dlng = point[1] - gp[1];
      if (dlat * dlat + dlng * dlng < PROXIMITY_THRESHOLD_SQ) {
        covered = true;
        break;
      }
    }

    if (!covered) {
      if (current.length === 0 && lastCoveredPoint) {
        current.push(lastCoveredPoint);
      }
      current.push(point);
    } else {
      if (current.length >= 2) {
        current.push(point);
        result.push(current);
      }
      current = [];
      lastCoveredPoint = point;
    }
  }

  if (current.length >= 2) {
    result.push(current);
  }

  return result;
}

function DynamicPolylines({
  polylines,
  incidents,
  direction,
}: {
  polylines: RoutePolyline[];
  incidents: Incident[];
  direction: Direction;
}) {
  const speedSegments = useMemo(
    () => buildSpeedSegments(polylines),
    [polylines]
  );

  const closedRoadSegments = useMemo(() => {
    const criticalRoutes = new Set<RouteId>();
    for (const inc of incidents) {
      if (inc.active && inc.severity === "critico" && inc.routeId) {
        criticalRoutes.add(inc.routeId);
      }
    }

    const segments: { routeId: RouteId; positions: [number, number][] }[] = [];
    for (const routeId of criticalRoutes) {
      const staticPath = STATIC_PATHS[routeId];
      if (!staticPath) continue;

      const rp = polylines.find(
        (p) => p.routeId === routeId && p.direction === direction
      );
      if (!rp) continue;

      const googlePoints = decode(rp.encodedPolyline, 5) as [number, number][];
      const uncovered = findUncoveredSegments(staticPath, googlePoints);

      for (const positions of uncovered) {
        segments.push({ routeId, positions });
      }
    }

    return segments;
  }, [incidents, polylines, direction]);

  const dirPolylines = polylines.filter((p) => p.direction === direction);

  return (
    <>
      {dirPolylines.map((rp) => {
        const decoded = decode(rp.encodedPolyline, 5) as [number, number][];
        return (
          <Polyline
            key={`shadow-${rp.routeId}-${direction}`}
            positions={decoded}
            pathOptions={{
              color: ROUTE_COLORS[rp.routeId],
              weight: 10,
              opacity: 0.15,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        );
      })}

      {speedSegments
        .filter((s) => s.direction === direction)
        .map((seg, i) => (
          <Polyline
            key={`speed-${seg.routeId}-${seg.direction}-${i}`}
            positions={seg.positions}
            pathOptions={{
              color: seg.color,
              weight: 6,
              opacity: 0.9,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        ))}

      {closedRoadSegments.map((seg, i) => (
        <Polyline
          key={`closed-${seg.routeId}-${i}`}
          positions={seg.positions}
          pathOptions={{
            color: "#475569",
            weight: 5,
            opacity: 0.6,
            dashArray: "8 12",
            lineJoin: "round",
            lineCap: "round",
          }}
        />
      ))}
    </>
  );
}

export default function TrafficMapInner({
  states,
  incidents,
  polylines,
  direction,
}: Props) {
  const hasDynamicPolylines = polylines.length > 0;

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

        <Marker position={AREQUIPA_CENTER} icon={arequipaIcon}>
          <Popup>
            <div className="text-sm font-bold text-slate-100">Arequipa</div>
            <div className="text-xs text-slate-400">
              Sachaca / Inicio corredor
            </div>
          </Popup>
        </Marker>

        <Marker position={KM48_COORDS} icon={km48Icon}>
          <Tooltip
            permanent
            direction="bottom"
            offset={[0, 14]}
            className="km48-label"
          >
            <span
              style={{
                background: "#0f172a",
                color: "#10b981",
                fontWeight: 700,
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #10b981",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
              }}
            >
              KM 48
            </span>
          </Tooltip>
          <Popup>
            <div className="text-sm font-bold text-slate-100">
              {KM48_LABEL}
            </div>
            <div className="text-xs text-slate-400">Punto de confluencia</div>
          </Popup>
        </Marker>

        {hasDynamicPolylines ? (
          <DynamicPolylines
            polylines={polylines}
            incidents={incidents}
            direction={direction}
          />
        ) : (
          <StaticSegmentsFallback states={states} />
        )}

        {incidents
          .filter(
            (i) =>
              i.active && (i.severity === "critico" || i.severity === "alto")
          )
          .map((incident) => (
            <Marker
              key={incident.id}
              position={incident.coords}
              icon={incidentIcon}
            >
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <p className="font-bold mb-1 text-slate-100">
                    {INCIDENT_ICONS[incident.type]} {incident.title}
                  </p>
                  <p className="text-xs text-slate-300 mb-1">
                    {incident.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    Fuente: {incident.source.toUpperCase()}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
  );
}
