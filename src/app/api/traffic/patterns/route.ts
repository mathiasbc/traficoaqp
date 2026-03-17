import { NextResponse } from "next/server";
import { getAllHourlyAverages, averageToHourlyPattern } from "@/lib/db";

export async function GET() {
  try {
    const averages = getAllHourlyAverages();

    if (averages.length > 0) {
      const patterns = averages.map(averageToHourlyPattern);
      return NextResponse.json(patterns);
    }

    return NextResponse.json([]);
  } catch (err) {
    console.error("[api/traffic/patterns] DB error:", err);
    return NextResponse.json([]);
  }
}
