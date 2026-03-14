import type { TrafficState, Incident, HourlyPattern, RouteId, Direction } from "./types";
import { getCongestionLevel } from "./colors";
import { ALL_SEGMENTS, ROUTE_CONFIG } from "./roads";

// Direction-aware: salida peaks morning, ingreso peaks evening
const WEEKDAY_SALIDA: Record<number, number> = {
  0: 0.3,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.5,  5: 1.0,
  6: 2.2,  7: 2.8,  8: 2.0,  9: 1.4,  10: 1.0, 11: 0.9,
  12: 1.1, 13: 1.2, 14: 1.4, 15: 1.2, 16: 1.0, 17: 0.9,
  18: 0.8, 19: 0.7, 20: 0.5, 21: 0.4, 22: 0.3, 23: 0.3,
};

const WEEKDAY_INGRESO: Record<number, number> = {
  0: 0.3,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.3,  5: 0.5,
  6: 0.8,  7: 1.0,  8: 1.2,  9: 1.0,  10: 0.9, 11: 0.9,
  12: 1.0, 13: 1.1, 14: 1.2, 15: 1.5, 16: 2.0, 17: 2.8,
  18: 2.5, 19: 1.8, 20: 1.2, 21: 0.8, 22: 0.5, 23: 0.3,
};

const SATURDAY_SALIDA: Record<number, number> = {
  0: 0.2,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.3,  5: 0.6,
  6: 1.2,  7: 1.8,  8: 1.6,  9: 1.3,  10: 1.1, 11: 1.0,
  12: 1.2, 13: 1.1, 14: 1.0, 15: 0.9, 16: 0.8, 17: 0.7,
  18: 0.6, 19: 0.5, 20: 0.4, 21: 0.3, 22: 0.3, 23: 0.2,
};

const SATURDAY_INGRESO: Record<number, number> = {
  0: 0.2,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.2,  5: 0.4,
  6: 0.6,  7: 0.8,  8: 1.0,  9: 1.1,  10: 1.0, 11: 1.0,
  12: 1.1, 13: 1.2, 14: 1.3, 15: 1.5, 16: 1.8, 17: 2.0,
  18: 1.8, 19: 1.4, 20: 1.0, 21: 0.7, 22: 0.4, 23: 0.3,
};

const SUNDAY_SALIDA: Record<number, number> = {
  0: 0.2,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.2,  5: 0.3,
  6: 0.5,  7: 0.8,  8: 1.0,  9: 1.1,  10: 1.0, 11: 0.9,
  12: 0.9, 13: 0.8, 14: 0.8, 15: 0.7, 16: 0.6, 17: 0.5,
  18: 0.5, 19: 0.4, 20: 0.3, 21: 0.3, 22: 0.2, 23: 0.2,
};

const SUNDAY_INGRESO: Record<number, number> = {
  0: 0.2,  1: 0.2,  2: 0.2,  3: 0.2,  4: 0.2,  5: 0.3,
  6: 0.4,  7: 0.6,  8: 0.8,  9: 0.9,  10: 1.0, 11: 1.0,
  12: 1.1, 13: 1.2, 14: 1.3, 15: 1.6, 16: 2.2, 17: 2.8,
  18: 2.4, 19: 1.8, 20: 1.2, 21: 0.8, 22: 0.5, 23: 0.3,
};

// Per-segment congestion factors
const SEGMENT_FACTORS: Record<string, number> = {
  // Uchumayo — popular commuter route, more congested
  "uchumayo-0": 1.4,   // Sachaca → Congata: heavy urban exit
  "uchumayo-1": 1.6,   // Congata → Uchumayo: narrow bottleneck
  "uchumayo-2": 1.8,   // Uchumayo → Km 24 (Puente): bridge zone, worst segment
  "uchumayo-3": 1.3,   // Km 24 → Km 36: opens up after bridge
  "uchumayo-4": 1.0,   // Km 36 → Km 48: approaching Repartición, flows well

  // Cerro Verde — lighter alternative
  "cerro-verde-0": 1.2, // Sachaca exit
  "cerro-verde-1": 1.3, // Mine approach, some truck traffic
  "cerro-verde-2": 1.1, // Through mining area
  "cerro-verde-3": 0.9, // Open road
  "cerro-verde-4": 0.8, // Approach to Km 48
};

// Per-route congestion multipliers
const ROUTE_FACTORS: Record<RouteId, number> = {
  uchumayo: 1.55,       // Popular, more congested route
  "cerro-verde": 1.05,  // Lighter alternative
};

// Uchumayo peaks ~10-15% harder at rush hours (the commuter route)
const ROUTE_PEAK_BOOST: Record<RouteId, Record<number, number>> = {
  uchumayo: { 6: 1.1, 7: 1.15, 8: 1.1, 16: 1.1, 17: 1.15, 18: 1.1 },
  "cerro-verde": {},
};

function getDirectionMultipliers(
  dayType: "weekday" | "saturday" | "sunday",
  direction: Direction
): Record<number, number> {
  if (dayType === "saturday") return direction === "salida" ? SATURDAY_SALIDA : SATURDAY_INGRESO;
  if (dayType === "sunday") return direction === "salida" ? SUNDAY_SALIDA : SUNDAY_INGRESO;
  return direction === "salida" ? WEEKDAY_SALIDA : WEEKDAY_INGRESO;
}

function getDayType(date: Date): "weekday" | "saturday" | "sunday" {
  const day = date.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

function jitter(value: number, pct: number = 0.2): number {
  const variation = 1 + (Math.random() * 2 - 1) * pct;
  return value * variation;
}

export function generateTrafficState(hour?: number): TrafficState[] {
  const now = new Date();
  const currentHour = hour ?? now.getHours();
  const dayType = getDayType(now);
  const results: TrafficState[] = [];
  const directions: Direction[] = ["salida", "ingreso"];

  for (const direction of directions) {
    const multipliers = getDirectionMultipliers(dayType, direction);
    const baseMultiplier = multipliers[currentHour] ?? 1.0;

    for (const segment of ALL_SEGMENTS) {
      const config = ROUTE_CONFIG[segment.routeId];

      // Skip closed routes — no traffic flows through
      if (config.closed) continue;

      const segFactor = SEGMENT_FACTORS[segment.id] ?? 1.0;
      const routeFactor = ROUTE_FACTORS[segment.routeId] ?? 1.0;
      const peakBoost = ROUTE_PEAK_BOOST[segment.routeId]?.[currentHour] ?? 1.0;

      const rawRatio = jitter(baseMultiplier * segFactor * routeFactor * peakBoost, 0.2);
      const congestionRatio = Math.max(0.3, rawRatio);
      const congestionLevel = getCongestionLevel(congestionRatio);

      const freeFlowSpeedKmh = (segment.distanceKm / segment.baseMinutes) * 60;
      const currentSpeedKmh = Math.max(5, freeFlowSpeedKmh / congestionRatio);
      const estimatedMinutes = Math.round(segment.baseMinutes * congestionRatio);

      const reportCount = Math.max(0, Math.round(jitter(congestionRatio * 3, 0.5)));

      results.push({
        segmentId: segment.id,
        direction,
        timestamp: now.toISOString(),
        currentSpeedKmh: Math.round(currentSpeedKmh),
        freeFlowSpeedKmh: Math.round(freeFlowSpeedKmh),
        estimatedMinutes,
        congestionLevel,
        congestionRatio: Math.round(congestionRatio * 100) / 100,
        reportCount,
      });
    }
  }

  return results;
}

export function generateHourlyPatterns(): HourlyPattern[] {
  const patterns: HourlyPattern[] = [];
  const routeIds: RouteId[] = ["uchumayo", "cerro-verde"];
  const directions: Direction[] = ["salida", "ingreso"];
  const dayTypes: ("weekday" | "saturday" | "sunday")[] = ["weekday", "saturday", "sunday"];

  for (const routeId of routeIds) {
    const config = ROUTE_CONFIG[routeId];
    if (config.closed) continue;

    const totalBaseMinutes = config.segments.reduce((sum, s) => sum + s.baseMinutes, 0);
    const routeFactor = ROUTE_FACTORS[routeId] ?? 1.0;

    for (const direction of directions) {
      for (const dayType of dayTypes) {
        const multipliers = getDirectionMultipliers(dayType, direction);

        for (let hour = 0; hour < 24; hour++) {
          const base = multipliers[hour];
          const peakBoost = ROUTE_PEAK_BOOST[routeId]?.[hour] ?? 1.0;
          const avgRatio = base * routeFactor * peakBoost;

          patterns.push({
            hour,
            dayType,
            routeId,
            direction,
            avgCongestionRatio: Math.round(avgRatio * 100) / 100,
            avgTotalMinutes: Math.round(totalBaseMinutes * avgRatio),
          });
        }
      }
    }
  }

  return patterns;
}

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: "inc-001",
    routeId: "uchumayo",
    segmentIndex: 2,
    type: "obras",
    severity: "medio",
    title: "Mantenimiento preventivo Puente Km 24+900",
    description:
      "COVISUR realizando trabajos de mantenimiento en losa. Tránsito operativo con un carril habilitado.",
    coords: [-16.438366, -71.691639],
    reportedAt: "2026-03-12T06:00:00-05:00",
    reportedBy: "covisur",
    active: true,
  },
  {
    id: "inc-002",
    routeId: "uchumayo",
    segmentIndex: 0,
    type: "policia",
    severity: "bajo",
    title: "Control vehicular salida Sachaca",
    description:
      "Policía de tránsito regulando flujo en hora punta. Demora aproximada 5-10 min.",
    coords: [-16.405032, -71.565809],
    reportedAt: "2026-03-12T07:15:00-05:00",
    reportedBy: "comunidad",
    active: true,
  },
  {
    id: "inc-003",
    routeId: "cerro-verde",
    segmentIndex: 1,
    type: "policia",
    severity: "medio",
    title: "Control policial zona minera Cerro Verde",
    description: "Policía regulando tráfico en acceso a zona minera.",
    coords: [-16.500009, -71.628425],
    reportedAt: "2026-03-12T09:15:00-05:00",
    reportedBy: "comunidad",
    active: true,
  },
];
