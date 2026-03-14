import type { TrafficSegment, RouteId, Direction, RouteConfig } from "./types";
import { UCHUMAYO_PATH } from "./uchumayo-path";
import { CERRO_VERDE_PATH } from "./cerro-verde-path";

export { UCHUMAYO_PATH, CERRO_VERDE_PATH };

// Shared endpoint (snapped to road)
export const KM48_COORDS: [number, number] = [-16.528782, -71.780655];
export const KM48_LABEL = "Km 48 — La Repartición";

// Arequipa center (for map marker, snapped to road)
export const AREQUIPA_CENTER: [number, number] = [-16.411156, -71.556356];

function getPathSlice(
  path: [number, number][],
  startCoords: [number, number],
  endCoords: [number, number]
): [number, number][] {
  const startIdx = path.findIndex(
    (p) => p[0] === startCoords[0] && p[1] === startCoords[1]
  );
  const endIdx = path.findIndex(
    (p) => p[0] === endCoords[0] && p[1] === endCoords[1]
  );
  if (startIdx === -1 || endIdx === -1) return [startCoords, endCoords];
  return path.slice(startIdx, endIdx + 1);
}

// ── Uchumayo segment boundaries (snapped to OSRM road geometry) ──
export const UCHUMAYO_SEGMENTS: TrafficSegment[] = [
  {
    id: "uchumayo-0",
    routeId: "uchumayo",
    index: 0,
    name: "Sachaca → Congata",
    distanceKm: 4,
    baseMinutes: 8,
    startCoords: [-16.411156, -71.556356],
    endCoords: [-16.406012, -71.591310],
    polyline: getPathSlice(UCHUMAYO_PATH, [-16.411156, -71.556356], [-16.406012, -71.591310]),
  },
  {
    id: "uchumayo-1",
    routeId: "uchumayo",
    index: 1,
    name: "Congata → Uchumayo",
    distanceKm: 5,
    baseMinutes: 10,
    startCoords: [-16.406012, -71.591310],
    endCoords: [-16.413862, -71.622096],
    polyline: getPathSlice(UCHUMAYO_PATH, [-16.406012, -71.591310], [-16.413862, -71.622096]),
  },
  {
    id: "uchumayo-2",
    routeId: "uchumayo",
    index: 2,
    name: "Uchumayo → Km 24 (Puente)",
    distanceKm: 7,
    baseMinutes: 10,
    startCoords: [-16.413862, -71.622096],
    endCoords: [-16.443083, -71.689925],
    polyline: getPathSlice(UCHUMAYO_PATH, [-16.413862, -71.622096], [-16.443083, -71.689925]),
  },
  {
    id: "uchumayo-3",
    routeId: "uchumayo",
    index: 3,
    name: "Km 24 → Km 36",
    distanceKm: 10,
    baseMinutes: 12,
    startCoords: [-16.443083, -71.689925],
    endCoords: [-16.509050, -71.743458],
    polyline: getPathSlice(UCHUMAYO_PATH, [-16.443083, -71.689925], [-16.509050, -71.743458]),
  },
  {
    id: "uchumayo-4",
    routeId: "uchumayo",
    index: 4,
    name: "Km 36 → Km 48 (Repartición)",
    distanceKm: 12,
    baseMinutes: 12,
    startCoords: [-16.509050, -71.743458],
    endCoords: [-16.528782, -71.780655],
    polyline: getPathSlice(UCHUMAYO_PATH, [-16.509050, -71.743458], [-16.528782, -71.780655]),
  },
];

// ── Cerro Verde segment boundaries (snapped to OSRM road geometry) ──
export const CERRO_VERDE_SEGMENTS: TrafficSegment[] = [
  {
    id: "cerro-verde-0",
    routeId: "cerro-verde",
    index: 0,
    name: "Sachaca → Quebrada Honda",
    distanceKm: 8,
    baseMinutes: 14,
    startCoords: [-16.411156, -71.556356],
    endCoords: [-16.454894, -71.591390],
    polyline: getPathSlice(CERRO_VERDE_PATH, [-16.411156, -71.556356], [-16.454894, -71.591390]),
  },
  {
    id: "cerro-verde-1",
    routeId: "cerro-verde",
    index: 1,
    name: "Quebrada Honda → Cerro Verde",
    distanceKm: 8,
    baseMinutes: 14,
    startCoords: [-16.454894, -71.591390],
    endCoords: [-16.512236, -71.631102],
    polyline: getPathSlice(CERRO_VERDE_PATH, [-16.454894, -71.591390], [-16.512236, -71.631102]),
  },
  {
    id: "cerro-verde-2",
    routeId: "cerro-verde",
    index: 2,
    name: "Cerro Verde → Desvío Sur",
    distanceKm: 6,
    baseMinutes: 10,
    startCoords: [-16.512236, -71.631102],
    endCoords: [-16.530412, -71.651632],
    polyline: getPathSlice(CERRO_VERDE_PATH, [-16.512236, -71.631102], [-16.530412, -71.651632]),
  },
  {
    id: "cerro-verde-3",
    routeId: "cerro-verde",
    index: 3,
    name: "Desvío Sur → Enlace Km 40",
    distanceKm: 8,
    baseMinutes: 12,
    startCoords: [-16.530412, -71.651632],
    endCoords: [-16.527041, -71.746291],
    polyline: getPathSlice(CERRO_VERDE_PATH, [-16.530412, -71.651632], [-16.527041, -71.746291]),
  },
  {
    id: "cerro-verde-4",
    routeId: "cerro-verde",
    index: 4,
    name: "Enlace Km 40 → Km 48 (Repartición)",
    distanceKm: 5,
    baseMinutes: 8,
    startCoords: [-16.527041, -71.746291],
    endCoords: [-16.528782, -71.780655],
    polyline: getPathSlice(CERRO_VERDE_PATH, [-16.527041, -71.746291], [-16.528782, -71.780655]),
  },
];

export const ALL_SEGMENTS: TrafficSegment[] = [
  ...UCHUMAYO_SEGMENTS,
  ...CERRO_VERDE_SEGMENTS,
];

export const ROUTE_CONFIG: Record<RouteId, RouteConfig> = {
  uchumayo: {
    routeId: "uchumayo",
    name: "Vía Uchumayo",
    shortName: "Uchumayo",
    icon: "🛣️",
    closed: false,
    segments: UCHUMAYO_SEGMENTS,
  },
  "cerro-verde": {
    routeId: "cerro-verde",
    name: "Vía Cerro Verde",
    shortName: "Cerro Verde",
    icon: "⛰️",
    closed: false,
    segments: CERRO_VERDE_SEGMENTS,
  },
};

export const DIRECTION_INFO: Record<Direction, { label: string; emoji: string; description: string }> = {
  salida: {
    label: "Salida de Arequipa",
    emoji: "→",
    description: "Arequipa → Km 48",
  },
  ingreso: {
    label: "Ingreso a Arequipa",
    emoji: "←",
    description: "Km 48 → Arequipa",
  },
};

export const INCIDENT_ICONS: Record<string, string> = {
  accidente: "🚗",
  obras: "🚧",
  cierre: "⛔",
  policia: "🚔",
  clima: "🌧️",
  derrumbe: "⚠️",
};
