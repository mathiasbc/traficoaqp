import type { Direction, RouteId, SpeedInterval, SpeedCategory } from "./types";
import type { SnapshotRow } from "./db";
import { getDayType, getPeruHour } from "./db";
import { getCongestionLevel } from "./colors";
import { AREQUIPA_CENTER, KM48_COORDS } from "./roads";

// ── TomTom Response Types ──

interface TomTomSummary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds: number;
  trafficLengthInMeters: number;
  departureTime: string;
  arrivalTime: string;
  noTrafficTravelTimeInSeconds?: number;
}

interface TomTomProgressEntry {
  pointIndex: number;
  distanceInMeters: number;
  travelTimeInSeconds: number;
}

interface TomTomLeg {
  summary: TomTomSummary;
  points?: Array<{ latitude: number; longitude: number }>;
  encodedPolyline?: string;
  encodedPolylinePrecision?: number;
}

interface TomTomRoute {
  summary: TomTomSummary;
  legs: TomTomLeg[];
  sections?: Array<{
    startPointIndex: number;
    endPointIndex: number;
    sectionType: string;
    simpleCategory?: string;
    effectiveSpeedInKmh?: number;
    delayInSeconds?: number;
    magnitudeOfDelay?: number;
  }>;
  progress?: TomTomProgressEntry[];
}

interface TomTomResponse {
  formatVersion: string;
  routes: TomTomRoute[];
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

const BASE_URL = "https://api.tomtom.com/routing/1/calculateRoute";

const NUM_SEGMENTS = 8;

// Circle waypoints anchor routes through the correct corridor (pass-through, no stops).
// Format: circle(lat,lon,radius_in_meters)
const UCHUMAYO_CIRCLES = [
  "circle(-16.406012,-71.591310,500)",
  "circle(-16.413862,-71.622096,500)",
];

const CERRO_VERDE_CIRCLES = [
  "circle(-16.512236,-71.631102,500)",
];

// ── API Client ──

function buildUrl(routeId: RouteId, direction: Direction): string {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new Error("TOMTOM_API_KEY not set");

  const isSalida = direction === "salida";
  const origin = isSalida
    ? `${AREQUIPA_CENTER[0]},${AREQUIPA_CENTER[1]}`
    : `${KM48_COORDS[0]},${KM48_COORDS[1]}`;
  const destination = isSalida
    ? `${KM48_COORDS[0]},${KM48_COORDS[1]}`
    : `${AREQUIPA_CENTER[0]},${AREQUIPA_CENTER[1]}`;

  const circles = routeId === "cerro-verde" ? CERRO_VERDE_CIRCLES : UCHUMAYO_CIRCLES;
  const orderedCircles = isSalida ? circles : [...circles].reverse();

  const locations = [origin, ...orderedCircles, destination].join(":");

  const params = new URLSearchParams({
    key: apiKey,
    traffic: "true",
    computeTravelTimeFor: "all",
    sectionType: "traffic",
    routeRepresentation: "encodedPolyline",
    travelMode: "car",
  });

  // extendedRouteRepresentation supports multiple values via repeated params
  return `${BASE_URL}/${locations}/json?${params}&extendedRouteRepresentation=travelTime&extendedRouteRepresentation=distance`;
}

async function fetchRoute(
  routeId: RouteId,
  direction: Direction,
): Promise<TomTomResponse> {
  const url = buildUrl(routeId, direction);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TomTom API ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Progress Array → Speed Intervals ──

function ratioToSpeedCategory(ratio: number): SpeedCategory {
  if (ratio <= 1.5) return "NORMAL";
  if (ratio <= 2.5) return "SLOW";
  return "TRAFFIC_JAM";
}

function progressToSpeedIntervals(
  progress: TomTomProgressEntry[],
  noTrafficTravelTimeSec: number,
  totalDistanceM: number,
): SpeedInterval[] {
  if (progress.length < 2) return [];

  const avgFreeFlowSpeed = totalDistanceM / noTrafficTravelTimeSec; // m/s

  const intervals: SpeedInterval[] = [];
  let currentCategory: SpeedCategory | null = null;
  let intervalStart = 0;

  for (let i = 1; i < progress.length; i++) {
    const prev = progress[i - 1];
    const curr = progress[i];
    const dt = curr.travelTimeInSeconds - prev.travelTimeInSeconds;
    const dd = curr.distanceInMeters - prev.distanceInMeters;

    if (dd <= 0 || dt <= 0) continue;

    const currentSpeed = dd / dt; // m/s
    const ratio = Math.max(1.0, avgFreeFlowSpeed / currentSpeed);
    const category = ratioToSpeedCategory(ratio);

    if (category !== currentCategory) {
      if (currentCategory !== null) {
        intervals.push({
          startPolylinePointIndex: intervalStart,
          endPolylinePointIndex: prev.pointIndex,
          speed: currentCategory,
        });
      }
      currentCategory = category;
      intervalStart = prev.pointIndex;
    }
  }

  // Close final interval
  if (currentCategory !== null) {
    intervals.push({
      startPolylinePointIndex: intervalStart,
      endPolylinePointIndex: progress[progress.length - 1].pointIndex,
      speed: currentCategory,
    });
  }

  return intervals;
}

// ── Response Parsing ──

function parseResponse(
  response: TomTomResponse,
  routeId: RouteId,
  direction: Direction,
): PollResult {
  const route = response.routes[0];
  if (!route) throw new Error(`No route returned for ${routeId} ${direction}`);

  const summary = route.summary;
  const progress = route.progress;

  // TomTom puts the encoded polyline inside the first leg (circle waypoints = single leg)
  const firstLeg = route.legs[0];
  const encodedPolyline = firstLeg?.encodedPolyline;
  const precision = firstLeg?.encodedPolylinePrecision ?? 5;

  if (!encodedPolyline) {
    throw new Error(`No polyline for ${routeId} ${direction}`);
  }
  if (!progress || progress.length < 2) {
    throw new Error(`No progress data for ${routeId} ${direction}`);
  }

  const totalDurationSec = summary.travelTimeInSeconds;
  const totalDistanceM = summary.lengthInMeters;
  const noTrafficSec = summary.noTrafficTravelTimeInSeconds ?? totalDurationSec;

  // Build speed intervals from progress array for map coloring
  const speedIntervals = progressToSpeedIntervals(progress, noTrafficSec, totalDistanceM);

  // Build per-segment snapshots from progress array
  const snapshots = buildSegmentSnapshots(
    progress, routeId, direction,
    totalDurationSec, totalDistanceM, noTrafficSec,
  );

  return {
    snapshots,
    routeId,
    direction,
    encodedPolyline,
    speedIntervals,
    totalDurationSec,
    totalDistanceM,
  };
}

// ── Segment Snapshots from Progress Array ──

function buildSegmentSnapshots(
  progress: TomTomProgressEntry[],
  routeId: RouteId,
  direction: Direction,
  totalDurationSec: number,
  totalDistanceM: number,
  noTrafficSec: number,
): SnapshotRow[] {
  const now = new Date();
  const timestamp = now.toISOString();
  const hour = getPeruHour(now);
  const dayType = getDayType(now);

  // Find progress entry at a target cumulative distance (called with increasing distances)
  let searchFrom = 1;
  function progressAtDistance(targetDist: number): TomTomProgressEntry {
    for (let i = searchFrom; i < progress.length; i++) {
      if (progress[i].distanceInMeters >= targetDist) {
        searchFrom = i; // resume here on next call
        const prev = progress[i - 1];
        const curr = progress[i];
        const segDist = curr.distanceInMeters - prev.distanceInMeters;
        if (segDist <= 0) return curr;
        const fraction = (targetDist - prev.distanceInMeters) / segDist;
        return {
          pointIndex: Math.round(prev.pointIndex + fraction * (curr.pointIndex - prev.pointIndex)),
          distanceInMeters: targetDist,
          travelTimeInSeconds: prev.travelTimeInSeconds + fraction * (curr.travelTimeInSeconds - prev.travelTimeInSeconds),
        };
      }
    }
    return progress[progress.length - 1];
  }

  const snapshots: SnapshotRow[] = [];
  const avgFreeFlowSpeedKmh = (totalDistanceM / 1000) / (noTrafficSec / 3600);

  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const startDist = (i / NUM_SEGMENTS) * totalDistanceM;
    const endDist = ((i + 1) / NUM_SEGMENTS) * totalDistanceM;

    const startProgress = progressAtDistance(startDist);
    const endProgress = progressAtDistance(endDist);

    const segDistM = endProgress.distanceInMeters - startProgress.distanceInMeters;
    const segTimeSec = endProgress.travelTimeInSeconds - startProgress.travelTimeInSeconds;

    const segDistKm = segDistM / 1000;
    const segTimeMin = segTimeSec / 60;

    // Free-flow time proportional to distance
    const segFreeFlowSec = noTrafficSec * (segDistM / totalDistanceM);
    const segFreeFlowMin = segFreeFlowSec / 60;

    // Current speed and free-flow speed for this segment
    const currentSpeedKmh = segTimeSec > 0 ? segDistKm / (segTimeSec / 3600) : avgFreeFlowSpeedKmh;
    const freeFlowSpeedKmh = segFreeFlowSec > 0 ? segDistKm / (segFreeFlowSec / 3600) : avgFreeFlowSpeedKmh;

    // Congestion ratio
    const ratio = Math.max(1.0, currentSpeedKmh > 0 ? freeFlowSpeedKmh / currentSpeedKmh : 1.0);

    snapshots.push({
      segment_id: `${routeId}-${i}`,
      route_id: routeId,
      direction,
      timestamp,
      hour,
      day_type: dayType,
      current_speed_kmh: Math.round(currentSpeedKmh * 10) / 10,
      free_flow_speed_kmh: Math.round(freeFlowSpeedKmh * 10) / 10,
      estimated_minutes: Math.round(segTimeMin * 10) / 10,
      congestion_ratio: Math.round(ratio * 100) / 100,
      congestion_level: getCongestionLevel(ratio),
    });
  }

  return snapshots;
}

// ── Public API ──

async function pollRoute(
  routeId: RouteId,
  direction: Direction,
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

  const settled = await Promise.allSettled(
    combos.map(({ routeId, direction }) => pollRoute(routeId, direction))
  );

  const results: PollResult[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      const { routeId, direction } = combos[i];
      console.error(`[poll] ${routeId} ${direction} failed:`, outcome.reason);
    }
  }

  return results;
}
