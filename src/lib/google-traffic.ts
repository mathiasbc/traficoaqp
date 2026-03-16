import { decode } from "@googlemaps/polyline-codec";
import type { Direction, RouteId, SpeedInterval } from "./types";
import type { SnapshotRow } from "./db";
import { getDayType, getPeruHour } from "./db";
import { getCongestionLevel } from "./colors";
import { AREQUIPA_CENTER, KM48_COORDS } from "./roads";

// ── Types ──

interface LatLng {
  latitude: number;
  longitude: number;
}

interface GoogleRouteResponse {
  routes: Array<{
    duration: string;
    distanceMeters: number;
    polyline?: { encodedPolyline: string };
    travelAdvisory?: {
      speedReadingIntervals: SpeedInterval[];
    };
    legs: Array<{
      steps: Array<{
        distanceMeters: number;
        staticDuration: string;
      }>;
    }>;
  }>;
}

export interface PollResult {
  snapshots: SnapshotRow[];
  routeId: RouteId;
  direction: Direction;
  encodedPolyline: string;
  speedIntervals: SpeedInterval[];
  totalDurationSec: number;
  totalDistanceM: number;
}

// ── Constants ──

const API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline",
  "routes.travelAdvisory",
  "routes.legs.steps",
].join(",");

const SPEED_TO_RATIO: Record<string, number> = {
  NORMAL: 1.0,
  SLOW: 1.8,
  TRAFFIC_JAM: 3.0,
};

const NUM_SEGMENTS = 5;

const UCHUMAYO_WAYPOINTS: LatLng[] = [
  { latitude: -16.406012, longitude: -71.591310 },
  { latitude: -16.413862, longitude: -71.622096 },
];

const CERRO_VERDE_WAYPOINTS: LatLng[] = [
  { latitude: -16.512236, longitude: -71.631102 },
];

// ── API Client ──

function buildRequestBody(routeId: RouteId, direction: Direction) {
  const isSalida = direction === "salida";
  const origin: LatLng = isSalida
    ? { latitude: AREQUIPA_CENTER[0], longitude: AREQUIPA_CENTER[1] }
    : { latitude: KM48_COORDS[0], longitude: KM48_COORDS[1] };
  const destination: LatLng = isSalida
    ? { latitude: KM48_COORDS[0], longitude: KM48_COORDS[1] }
    : { latitude: AREQUIPA_CENTER[0], longitude: AREQUIPA_CENTER[1] };

  const waypoints =
    routeId === "cerro-verde" ? CERRO_VERDE_WAYPOINTS : UCHUMAYO_WAYPOINTS;

  const intermediates = (isSalida ? waypoints : [...waypoints].reverse()).map(
    (wp) => ({ location: { latLng: wp }, via: true })
  );

  return {
    origin: { location: { latLng: origin } },
    destination: { location: { latLng: destination } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    extraComputations: ["TRAFFIC_ON_POLYLINE"],
    polylineQuality: "HIGH_QUALITY",
    intermediates,
  };
}

async function fetchRoute(
  routeId: RouteId,
  direction: Direction
): Promise<GoogleRouteResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(buildRequestBody(routeId, direction)),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Polyline Utilities ──

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cumulativeDistances(polyline: [number, number][]): number[] {
  const dists = [0];
  for (let i = 1; i < polyline.length; i++) {
    const d = haversineDistance(
      polyline[i - 1][0],
      polyline[i - 1][1],
      polyline[i][0],
      polyline[i][1]
    );
    dists.push(dists[i - 1] + d);
  }
  return dists;
}

function findIndexAtDistance(
  cumDists: number[],
  targetDist: number
): number {
  for (let i = 1; i < cumDists.length; i++) {
    if (cumDists[i] >= targetDist) return i;
  }
  return cumDists.length - 1;
}

function computeSegmentRatio(
  segStart: number,
  segEnd: number,
  intervals: SpeedInterval[]
): number {
  let totalWeight = 0;
  let weightedRatio = 0;

  for (const interval of intervals) {
    const overlapStart = Math.max(segStart, interval.startPolylinePointIndex);
    const overlapEnd = Math.min(segEnd, interval.endPolylinePointIndex);
    if (overlapStart >= overlapEnd) continue;

    const weight = overlapEnd - overlapStart;
    const ratio = SPEED_TO_RATIO[interval.speed] ?? 1.0;
    weightedRatio += ratio * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedRatio / totalWeight : 1.0;
}

// ── Response Parsing (dynamic equal-distance segments) ──

function parseResponse(
  response: GoogleRouteResponse,
  routeId: RouteId,
  direction: Direction
): PollResult {
  const route = response.routes[0];
  if (!route) throw new Error(`No route returned for ${routeId} ${direction}`);

  const intervals = route.travelAdvisory?.speedReadingIntervals ?? [];
  const encodedPolyline = route.polyline?.encodedPolyline;
  if (!encodedPolyline || intervals.length === 0) {
    throw new Error(`No traffic data for ${routeId} ${direction}`);
  }

  const polyline = decode(encodedPolyline, 5) as [number, number][];
  const totalDurationSec = parseInt(route.duration.replace("s", ""), 10);
  const totalDistanceM = route.distanceMeters;

  const cumDists = cumulativeDistances(polyline);
  const totalPolylineDist = cumDists[cumDists.length - 1];

  const now = new Date();
  const timestamp = now.toISOString();
  const hour = getPeruHour(now);
  const dayType = getDayType(now);

  const boundaryIndices: number[] = [0];
  for (let s = 1; s < NUM_SEGMENTS; s++) {
    const targetDist = (s / NUM_SEGMENTS) * totalPolylineDist;
    boundaryIndices.push(findIndexAtDistance(cumDists, targetDist));
  }
  boundaryIndices.push(polyline.length - 1);

  const snapshots: SnapshotRow[] = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const segStartIdx = boundaryIndices[i];
    const segEndIdx = boundaryIndices[i + 1];

    const ratio = computeSegmentRatio(segStartIdx, segEndIdx, intervals);
    const segDistM =
      cumDists[segEndIdx] - cumDists[segStartIdx];
    const segFraction = segDistM / totalPolylineDist;
    const estimatedMinutes = (totalDurationSec * segFraction) / 60;
    const freeFlowMinutes = estimatedMinutes / ratio;
    const segDistKm = segDistM / 1000;
    const freeFlowSpeed =
      freeFlowMinutes > 0 ? segDistKm / (freeFlowMinutes / 60) : 60;
    const currentSpeed = freeFlowSpeed / ratio;

    snapshots.push({
      segment_id: `${routeId}-${i}`,
      route_id: routeId,
      direction,
      timestamp,
      hour,
      day_type: dayType,
      current_speed_kmh: Math.round(currentSpeed * 10) / 10,
      free_flow_speed_kmh: Math.round(freeFlowSpeed * 10) / 10,
      estimated_minutes: Math.round(estimatedMinutes * 10) / 10,
      congestion_ratio: Math.round(ratio * 100) / 100,
      congestion_level: getCongestionLevel(ratio),
    });
  }

  return {
    snapshots,
    routeId,
    direction,
    encodedPolyline,
    speedIntervals: intervals,
    totalDurationSec,
    totalDistanceM,
  };
}

// ── Public API ──

async function pollRoute(
  routeId: RouteId,
  direction: Direction
): Promise<PollResult> {
  const response = await fetchRoute(routeId, direction);
  return parseResponse(response, routeId, direction);
}

export async function pollAllRoutes(): Promise<PollResult[]> {
  const combos: Array<{ routeId: RouteId; direction: Direction }> = [
    { routeId: "uchumayo", direction: "salida" },
    { routeId: "uchumayo", direction: "ingreso" },
    { routeId: "cerro-verde", direction: "salida" },
    { routeId: "cerro-verde", direction: "ingreso" },
  ];

  const results: PollResult[] = [];

  for (const { routeId, direction } of combos) {
    try {
      const result = await pollRoute(routeId, direction);
      results.push(result);
    } catch (err) {
      console.error(`[poll] ${routeId} ${direction} failed:`, err);
    }
  }

  return results;
}
