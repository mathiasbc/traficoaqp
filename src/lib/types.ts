export type CongestionLevel = "libre" | "moderado" | "alto" | "muy_alto" | "colapsado";

export type RouteId = "uchumayo" | "cerro-verde";

export type Direction = "salida" | "ingreso";

export type RouteDirectionKey = `${RouteId}-${Direction}`;

export interface TrafficSegment {
  id: string;
  routeId: RouteId;
  index: number;
  name: string;
  distanceKm: number;
  baseMinutes: number;
  startCoords: [number, number];
  endCoords: [number, number];
  polyline: [number, number][];
}

export interface TrafficState {
  segmentId: string;
  direction: Direction;
  timestamp: string;
  currentSpeedKmh: number;
  freeFlowSpeedKmh: number;
  estimatedMinutes: number;
  congestionLevel: CongestionLevel;
  congestionRatio: number;
  vehicleCount?: number;
  reportCount: number;
}

export type IncidentType = "accidente" | "obras" | "cierre" | "policia" | "clima" | "derrumbe";
export type IncidentSeverity = "critico" | "alto" | "medio" | "bajo";

export interface Incident {
  id: string;
  routeId: RouteId;
  segmentIndex: number;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  coords: [number, number];
  reportedAt: string;
  reportedBy: string;
  active: boolean;
}

export interface HourlyPattern {
  hour: number;
  dayType: "weekday" | "saturday" | "sunday";
  routeId: RouteId;
  direction: Direction;
  avgCongestionRatio: number;
  avgTotalMinutes: number;
}

export interface RouteConfig {
  routeId: RouteId;
  name: string;
  shortName: string;
  icon: string;
  closed: boolean;
  closureReason?: string;
  segments: TrafficSegment[];
}

export interface RouteSummaryData {
  routeId: RouteId;
  direction: Direction;
  key: RouteDirectionKey;
  name: string;
  shortName: string;
  icon: string;
  directionLabel: string;
  closed: boolean;
  closureReason?: string;
  totalEstimatedMinutes: number;
  overallCongestionLevel: CongestionLevel;
  segments: TrafficState[];
  activeIncidentCount: number;
}

export interface TrafficProvider {
  getSegmentTraffic(segment: TrafficSegment): Promise<TrafficState>;
  getRouteTime(routeId: string): Promise<{ totalMinutes: number; segments: TrafficState[] }>;
}
