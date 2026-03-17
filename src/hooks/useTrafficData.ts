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
  routeData: Record<RouteId, RouteTrafficData>;
  lastUpdated: Date;
}

interface CurrentApiResponse {
  states: TrafficState[];
  polylines: RoutePolyline[];
  dataSource?: "live" | "historical" | "none";
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
      .catch(() => setHourlyPatterns([]));

    fetchIncidents().then(setIncidents).catch(() => {});
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const data = await fetchTrafficCurrent();
      setStates(data.states);
      setPolylines(data.polylines);
      setLastUpdated(new Date());
    } catch {
      setStates([]);
      setPolylines([]);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 60000);
    return () => clearInterval(interval);
  }, [refreshData]);

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
    routeData,
    lastUpdated,
  };
}
