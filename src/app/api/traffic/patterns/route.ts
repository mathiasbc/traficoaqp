import { NextResponse } from "next/server";
import { getAllHourlyAverages, averageToHourlyPattern } from "@/lib/db";
import { generateHourlyPatterns } from "@/lib/mock-data";

export async function GET() {
  try {
    const averages = getAllHourlyAverages();

    if (averages.length > 0) {
      const patterns = averages.map(averageToHourlyPattern);
      return NextResponse.json(patterns);
    }

    return NextResponse.json(generateHourlyPatterns());
  } catch (err) {
    console.error("[api/traffic/patterns] DB error, falling back to mock:", err);
    return NextResponse.json(generateHourlyPatterns());
  }
}
