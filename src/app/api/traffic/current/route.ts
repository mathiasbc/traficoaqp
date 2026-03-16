import { NextRequest, NextResponse } from "next/server";
import {
  getLatestSnapshots,
  getHourlyAverages,
  getRoutePolylines,
  snapshotToTrafficState,
  averageToTrafficState,
  getDayType,
  getPeruHour,
} from "@/lib/db";
import { ALL_SEGMENTS } from "@/lib/roads";
import { generateTrafficState } from "@/lib/mock-data";
import type { RouteId, RoutePolyline } from "@/lib/types";

interface CurrentResponse {
  states: ReturnType<typeof snapshotToTrafficState>[];
  polylines: RoutePolyline[];
}

export async function GET(request: NextRequest) {
  const hourParam = request.nextUrl.searchParams.get("hour");

  try {
    if (hourParam !== null) {
      return getSimulatedData(parseInt(hourParam, 10));
    }
    return getLiveData();
  } catch (err) {
    console.error("[api/traffic/current] DB error, falling back to mock:", err);
    const hour = hourParam !== null ? parseInt(hourParam, 10) : undefined;
    const states = generateTrafficState(hour);
    return NextResponse.json({ states, polylines: [] } satisfies CurrentResponse);
  }
}

function getPolylines(): RoutePolyline[] {
  try {
    return getRoutePolylines();
  } catch {
    return [];
  }
}

function getLiveData() {
  const polylines = getPolylines();
  const snapshots = getLatestSnapshots();

  if (snapshots.length > 0) {
    const states = snapshots.map(snapshotToTrafficState);
    return NextResponse.json({ states, polylines } satisfies CurrentResponse);
  }

  const hour = getPeruHour();
  const dayType = getDayType();
  const averages = getHourlyAverages(hour, dayType);

  if (averages.length > 0) {
    const segmentMap = new Map(ALL_SEGMENTS.map((s) => [s.id, s]));
    const states = averages.map((avg) => {
      const seg = segmentMap.get(avg.segment_id);
      const routeId = avg.segment_id.split("-").slice(0, -1).join("-") as RouteId;
      return averageToTrafficState(avg, routeId, seg?.baseMinutes ?? 10);
    });
    return NextResponse.json({ states, polylines } satisfies CurrentResponse);
  }

  const states = generateTrafficState();
  return NextResponse.json({ states, polylines } satisfies CurrentResponse);
}

function getSimulatedData(hour: number) {
  const polylines = getPolylines();
  const dayType = getDayType();
  const averages = getHourlyAverages(hour, dayType);

  if (averages.length > 0) {
    const segmentMap = new Map(ALL_SEGMENTS.map((s) => [s.id, s]));
    const states = averages.map((avg) => {
      const seg = segmentMap.get(avg.segment_id);
      const routeId = avg.segment_id.split("-").slice(0, -1).join("-") as RouteId;
      return averageToTrafficState(avg, routeId, seg?.baseMinutes ?? 10);
    });
    return NextResponse.json({ states, polylines } satisfies CurrentResponse);
  }

  const states = generateTrafficState(hour);
  return NextResponse.json({ states, polylines } satisfies CurrentResponse);
}
