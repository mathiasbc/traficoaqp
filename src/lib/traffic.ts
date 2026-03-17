import type { TrafficState, Incident, RouteId, Direction, RouteSummaryData, RouteDirectionKey } from "./types";
import { getCongestionLevel } from "./colors";
import { ROUTE_CONFIG, DIRECTION_INFO } from "./roads";

export function calculateRouteSummary(
  routeId: RouteId,
  direction: Direction,
  states: TrafficState[],
  incidents: Incident[]
): RouteSummaryData {
  const config = ROUTE_CONFIG[routeId];
  const key: RouteDirectionKey = `${routeId}-${direction}`;
  const dirInfo = DIRECTION_INFO[direction];

  const routeIncidentCount = incidents.filter(
    (i) => i.routeId === routeId && i.active
  ).length;

  // Closed routes: return closed summary with no traffic data
  if (config.closed) {
    return {
      routeId,
      direction,
      key,
      name: config.name,
      shortName: config.shortName,
      icon: config.icon,
      directionLabel: dirInfo.description,
      closed: true,
      closureReason: config.closureReason,
      totalEstimatedMinutes: 0,
      overallCongestionLevel: "colapsado",
      segments: [],
      activeIncidentCount: routeIncidentCount,
    };
  }

  const routeStates = states.filter(
    (s) => s.segmentId.startsWith(routeId) && s.direction === direction
  );

  const totalEstimatedMinutes = routeStates.reduce(
    (sum, s) => sum + s.estimatedMinutes,
    0
  );

  const avgRatio =
    routeStates.length > 0
      ? routeStates.reduce((sum, s) => sum + s.congestionRatio, 0) /
        routeStates.length
      : 1;

  return {
    routeId,
    direction,
    key,
    name: config.name,
    shortName: config.shortName,
    icon: config.icon,
    directionLabel: dirInfo.description,
    closed: false,
    totalEstimatedMinutes,
    overallCongestionLevel: getCongestionLevel(avgRatio),
    segments: routeStates,
    activeIncidentCount: routeIncidentCount,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

export function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

export function formatPeruTime(date: Date): string {
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  });
}

/** Returns current hour (0–23) in Peru timezone. Use for charts/UI to match header time. */
export function getPeruHour(date?: Date): number {
  const d = date ?? new Date();
  const peruStr = d.toLocaleString("en-US", { timeZone: "America/Lima" });
  return new Date(peruStr).getHours();
}

