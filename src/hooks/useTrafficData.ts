"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TrafficState,
  Incident,
  HourlyPattern,
  RouteSummaryData,
  RouteId,
  Direction,
  RoutePolyline,
} from "@/lib/types";
import { generateTrafficState, generateHourlyPatterns } from "@/lib/mock-data";
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
  polylines: RoutePolyline[];
  allHourlyPatterns: HourlyPattern[];
  routeData: Record<RouteId, RouteTrafficData>;
  simulatedHour: number | null;
  setSimulatedHour: (hour: number | null) => void;
  lastUpdated: Date;
  isLive: boolean;
}

interface CurrentApiResponse {
  states: TrafficState[];
  polylines: RoutePolyline[];
}

async function fetchTrafficCurrent(
  hour?: number
): Promise<CurrentApiResponse> {
  const url =
    hour !== undefined
      ? `/api/traffic/current?hour=${hour}`
      : "/api/traffic/current";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function fetchPatterns(): Promise<HourlyPattern[]> {
  const res = await fetch("/api/traffic/patterns");
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch("/api/incidents");
  if (!res.ok) return [];
  return res.json();
}

export function useTrafficData(): TrafficData {
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);
  const [states, setStates] = useState<TrafficState[]>([]);
  const [polylines, setPolylines] = useState<RoutePolyline[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hourlyPatterns, setHourlyPatterns] = useState<HourlyPattern[]>([]);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    fetchPatterns()
      .then(setHourlyPatterns)
      .catch(() => setHourlyPatterns(generateHourlyPatterns()));

    fetchIncidents().then(setIncidents).catch(() => {});
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const hour = simulatedHour ?? undefined;
      const data = await fetchTrafficCurrent(hour);
      setStates(data.states);
      setPolylines(data.polylines);
      setLastUpdated(new Date());
    } catch {
      const hour = simulatedHour ?? undefined;
      setStates(generateTrafficState(hour));
      setLastUpdated(new Date());
    }
  }, [simulatedHour]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (simulatedHour !== null) return;
    const interval = setInterval(refreshData, 60000);
    return () => clearInterval(interval);
  }, [simulatedHour, refreshData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchIncidents().then(setIncidents).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const summaries: RouteSummaryData[] = [];
  for (const routeId of ROUTE_IDS) {
    for (const direction of DIRECTIONS) {
      summaries.push(
        calculateRouteSummary(routeId, direction, states, incidents)
      );
    }
  }

  const routeData: Record<RouteId, RouteTrafficData> = {
    uchumayo: {
      salida: summaries.find(
        (s) => s.routeId === "uchumayo" && s.direction === "salida"
      )!,
      ingreso: summaries.find(
        (s) => s.routeId === "uchumayo" && s.direction === "ingreso"
      )!,
      hourlyPatterns: hourlyPatterns.filter((p) => p.routeId === "uchumayo"),
    },
    "cerro-verde": {
      salida: summaries.find(
        (s) => s.routeId === "cerro-verde" && s.direction === "salida"
      )!,
      ingreso: summaries.find(
        (s) => s.routeId === "cerro-verde" && s.direction === "ingreso"
      )!,
      hourlyPatterns: hourlyPatterns.filter(
        (p) => p.routeId === "cerro-verde"
      ),
    },
  };

  return {
    states,
    incidents,
    polylines,
    allHourlyPatterns: hourlyPatterns,
    routeData,
    simulatedHour,
    setSimulatedHour,
    lastUpdated,
    isLive: simulatedHour === null,
  };
}
