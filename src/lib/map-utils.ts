import type { RouteId, Incident } from "./types";
import { UCHUMAYO_PATH } from "./uchumayo-path";
import { CERRO_VERDE_PATH } from "./cerro-verde-path";

export const STATIC_PATHS: Record<RouteId, [number, number][]> = {
  uchumayo: UCHUMAYO_PATH,
  "cerro-verde": CERRO_VERDE_PATH,
};

// ~330m threshold in degrees for "same road" proximity
const PROXIMITY_THRESHOLD_SQ = 0.003 * 0.003;

export function findUncoveredSegments(
  staticPath: [number, number][],
  googlePolyline: [number, number][],
  thresholdSq: number = PROXIMITY_THRESHOLD_SQ
): [number, number][][] {
  const result: [number, number][][] = [];
  let current: [number, number][] = [];
  let lastCoveredPoint: [number, number] | null = null;

  for (const point of staticPath) {
    let covered = false;
    for (const gp of googlePolyline) {
      const dlat = point[0] - gp[0];
      const dlng = point[1] - gp[1];
      if (dlat * dlat + dlng * dlng < thresholdSq) {
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

export function getClosedRouteIds(incidents: Incident[]): Set<RouteId> {
  const set = new Set<RouteId>();
  for (const inc of incidents) {
    if (inc.active && inc.severity === "critico" && inc.routeId) {
      set.add(inc.routeId);
    }
  }
  return set;
}
