import { NextRequest, NextResponse } from "next/server";
import { getActiveIncidents, incidentRowToIncident } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const routeId = request.nextUrl.searchParams.get("route") || undefined;
    const rows = getActiveIncidents(routeId);
    const incidents = rows.map(incidentRowToIncident);
    return NextResponse.json(incidents);
  } catch (err) {
    console.error("[api/incidents] DB error:", err);
    return NextResponse.json([]);
  }
}
