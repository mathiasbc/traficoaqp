import cron from "node-cron";
import { pollAllRoutes } from "./google-traffic";
import { insertSnapshots, upsertRoutePolyline, recomputeAverages, purgeOldSnapshots, upsertIncidents, resolveStaleIncidents } from "./db";
import { fetchSutranAlerts } from "./sutran-scraper";

let started = false;

async function runTrafficPoll(): Promise<void> {
  const results = await pollAllRoutes();
  const allSnapshots = results.flatMap((r) => r.snapshots);
  if (allSnapshots.length > 0) {
    insertSnapshots(allSnapshots);
    recomputeAverages();
  }
  for (const r of results) {
    upsertRoutePolyline(
      r.routeId,
      r.direction,
      r.encodedPolyline,
      r.speedIntervals,
      r.totalDurationSec,
      r.totalDistanceM
    );
  }
  console.log(
    `[poll] ${allSnapshots.length} snapshots, ${results.length} polylines`
  );
}

async function pollIncidents(): Promise<void> {
  const sutran = await fetchSutranAlerts();

  if (sutran.length > 0) {
    upsertIncidents(sutran);
  }
  // Resolve any incidents no longer returned by SUTRAN
  resolveStaleIncidents("sutran", sutran.map((i) => i.id));

  console.log(`[incidents] ${sutran.length} SUTRAN alerts`);
}

export function startScheduler(): void {
  if (started) return;
  started = true;

  console.log("[scheduler] Starting: traffic (8 fixed polls/day PET), incidents (30 min), daily recompute (03:00 PET)");

  // Traffic polling — 8 fixed times per day (Peru time), weighted toward rush hours.
  //
  // BUDGET CONSTRAINT: TRAFFIC_ON_POLYLINE triggers Enterprise SKU (1,000 free calls/month).
  // The $200/month credit was replaced with per-SKU free tiers on March 2025.
  //   Enterprise: 1,000 free → then $15/1000
  //   Pro:        5,000 free → then $10/1000 (only TRAFFIC_AWARE, no polyline colors)
  //
  // Schedule: 6, 8, 9, 12, 15, 17, 19, 21 (Peru time)
  //   → 3 during AM rush (6, 8, 9), 2 midday (12, 15), 3 during PM rush (17, 19, 21)
  //   → 8 polls/day × 4 calls × 31 days = 992 calls/month (under 1,000 free tier)
  cron.schedule(
    "0 6,8,9,12,15,17,19,21 * * *",
    async () => {
      try {
        await runTrafficPoll();
      } catch (err) {
        console.error("[poll] Cycle failed:", err);
      }
    },
    { timezone: "America/Lima" }
  );

  // Incident polling — every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      await pollIncidents();
    } catch (err) {
      console.error("[incidents] Cycle failed:", err);
    }
  });

  // Daily recomputation — 03:00 Peru time
  cron.schedule(
    "0 3 * * *",
    () => {
      try {
        recomputeAverages();
        const purged = purgeOldSnapshots(20);
        console.log(`[daily] Recomputed averages, purged ${purged} old rows`);
      } catch (err) {
        console.error("[daily] Recomputation failed:", err);
      }
    },
    { timezone: "America/Lima" }
  );

  // Run initial incident poll on startup
  pollIncidents().catch((err) => console.error("[incidents] Initial poll failed:", err));

  // Initial recompute so congestion charts show data from existing snapshots
  try {
    recomputeAverages();
    console.log("[scheduler] Initial recompute done");
  } catch (err) {
    console.error("[scheduler] Initial recompute failed:", err);
  }
}
