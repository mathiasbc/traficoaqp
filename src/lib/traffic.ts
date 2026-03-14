import type { TrafficState, RouteId, Direction, RouteSummaryData, RouteDirectionKey } from "./types";
import { getCongestionLevel } from "./colors";
import { ROUTE_CONFIG, DIRECTION_INFO } from "./roads";
import { MOCK_INCIDENTS } from "./mock-data";

export function calculateRouteSummary(
  routeId: RouteId,
  direction: Direction,
  states: TrafficState[]
): RouteSummaryData {
  const config = ROUTE_CONFIG[routeId];
  const key: RouteDirectionKey = `${routeId}-${direction}`;
  const dirInfo = DIRECTION_INFO[direction];

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
      activeIncidentCount: MOCK_INCIDENTS.filter(
        (i) => i.routeId === routeId && i.active
      ).length,
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
    activeIncidentCount: MOCK_INCIDENTS.filter(
      (i) => i.routeId === routeId && i.active
    ).length,
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

export function getCurrentPeruTime(): Date {
  const now = new Date();
  return new Date(
    now.toLocaleString("en-US", { timeZone: "America/Lima" })
  );
}

export function formatPeruTime(date: Date): string {
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

export function formatPeruDate(date: Date): string {
  return date.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  });
}
