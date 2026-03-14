"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrafficState, Incident, HourlyPattern, RouteSummaryData, RouteId, Direction } from "@/lib/types";
import { generateTrafficState, generateHourlyPatterns, MOCK_INCIDENTS } from "@/lib/mock-data";
import { calculateRouteSummary } from "@/lib/traffic";

const ROUTE_IDS: RouteId[] = ["uchumayo", "cerro-verde"];
const DIRECTIONS: Direction[] = ["salida", "ingreso"];

export interface RouteTrafficData {
  salida: RouteSummaryData;
  ingreso: RouteSummaryData;
  hourlyPatterns: HourlyPattern[];
}

interface TrafficData {
  states: TrafficState[];
  incidents: Incident[];
  allHourlyPatterns: HourlyPattern[];
  routeData: Record<RouteId, RouteTrafficData>;
  simulatedHour: number | null;
  setSimulatedHour: (hour: number | null) => void;
  lastUpdated: Date;
  isLive: boolean;
}

export function useTrafficData(): TrafficData {
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);
  const [states, setStates] = useState<TrafficState[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hourlyPatterns] = useState<HourlyPattern[]>(() =>
    generateHourlyPatterns()
  );

  const refreshData = useCallback(() => {
    const hour = simulatedHour ?? undefined;
    const newStates = generateTrafficState(hour);
    setStates(newStates);
    setLastUpdated(new Date());
  }, [simulatedHour]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (simulatedHour !== null) return;
    const interval = setInterval(refreshData, 60000);
    return () => clearInterval(interval);
  }, [simulatedHour, refreshData]);

  // Build all 4 summaries (2 routes × 2 directions)
  const summaries: RouteSummaryData[] = [];
  for (const routeId of ROUTE_IDS) {
    for (const direction of DIRECTIONS) {
      summaries.push(calculateRouteSummary(routeId, direction, states));
    }
  }

  // Group by route
  const routeData: Record<RouteId, RouteTrafficData> = {
    uchumayo: {
      salida: summaries.find((s) => s.routeId === "uchumayo" && s.direction === "salida")!,
      ingreso: summaries.find((s) => s.routeId === "uchumayo" && s.direction === "ingreso")!,
      hourlyPatterns: hourlyPatterns.filter((p) => p.routeId === "uchumayo"),
    },
    "cerro-verde": {
      salida: summaries.find((s) => s.routeId === "cerro-verde" && s.direction === "salida")!,
      ingreso: summaries.find((s) => s.routeId === "cerro-verde" && s.direction === "ingreso")!,
      hourlyPatterns: hourlyPatterns.filter((p) => p.routeId === "cerro-verde"),
    },
  };

  return {
    states,
    incidents: MOCK_INCIDENTS.filter((i) => i.active),
    allHourlyPatterns: hourlyPatterns,
    routeData,
    simulatedHour,
    setSimulatedHour,
    lastUpdated,
    isLive: simulatedHour === null,
  };
}
