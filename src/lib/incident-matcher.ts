import type { RouteId } from "./types";
import { UCHUMAYO_PATH } from "./uchumayo-path";
import { CERRO_VERDE_PATH } from "./cerro-verde-path";
import { UCHUMAYO_SEGMENTS, CERRO_VERDE_SEGMENTS } from "./roads";

const CORRIDOR_BBOX = {
  minLat: -16.55,
  maxLat: -16.38,
  minLng: -71.80,
  maxLng: -71.55,
};

const MAX_DISTANCE_KM = 1.0;

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestPointIndex(
  lat: number,
  lng: number,
  path: [number, number][]
): { index: number; distance: number } {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversineKm(lat, lng, path[i][0], path[i][1]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, distance: bestDist };
}

interface MatchResult {
  routeId: RouteId | null;
  segmentId: string | null;
}

export function isInCorridor(lat: number, lng: number): boolean {
  return (
    lat >= CORRIDOR_BBOX.minLat && lat <= CORRIDOR_BBOX.maxLat &&
    lng >= CORRIDOR_BBOX.minLng && lng <= CORRIDOR_BBOX.maxLng
  );
}

export function matchIncidentToSegment(lat: number, lng: number): MatchResult {
  if (!isInCorridor(lat, lng)) {
    return { routeId: null, segmentId: null };
  }

  const uch = findNearestPointIndex(lat, lng, UCHUMAYO_PATH);
  const cv = findNearestPointIndex(lat, lng, CERRO_VERDE_PATH);

  const nearest = uch.distance <= cv.distance
    ? { routeId: "uchumayo" as RouteId, path: UCHUMAYO_PATH, ...uch }
    : { routeId: "cerro-verde" as RouteId, path: CERRO_VERDE_PATH, ...cv };

  if (nearest.distance > MAX_DISTANCE_KM) {
    return { routeId: null, segmentId: null };
  }

  const segments = nearest.routeId === "uchumayo"
    ? UCHUMAYO_SEGMENTS
    : CERRO_VERDE_SEGMENTS;

  const nearestCoord = nearest.path[nearest.index];

  for (const segment of segments) {
    const startIdx = nearest.path.findIndex(
      (p) => p[0] === segment.startCoords[0] && p[1] === segment.startCoords[1]
    );
    const endIdx = nearest.path.findIndex(
      (p) => p[0] === segment.endCoords[0] && p[1] === segment.endCoords[1]
    );
    if (startIdx === -1 || endIdx === -1) continue;

    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    const ptIdx = nearest.path.indexOf(nearestCoord);
    if (ptIdx >= lo && ptIdx <= hi) {
      return { routeId: nearest.routeId, segmentId: segment.id };
    }
  }

  return { routeId: nearest.routeId, segmentId: null };
}
