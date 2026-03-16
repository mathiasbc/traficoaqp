import cron from "node-cron";
import { pollAllRoutes } from "./google-traffic";
import { insertSnapshots, upsertRoutePolyline, recomputeAverages, purgeOldSnapshots, upsertIncidents, resolveStaleIncidents } from "./db";
import { fetchSutranAlerts } from "./sutran-scraper";

let started = false;

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

  console.log("[scheduler] Starting: traffic (5 min), incidents (30 min), daily recompute (03:00 PET)");

  // Traffic polling — every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const results = await pollAllRoutes();
      const allSnapshots = results.flatMap((r) => r.snapshots);
      if (allSnapshots.length > 0) {
        insertSnapshots(allSnapshots);
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
    } catch (err) {
      console.error("[poll] Cycle failed:", err);
    }
  });

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
}
