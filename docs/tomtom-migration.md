# Google Maps → TomTom Migration Plan

## Why

Google Maps Routes API uses the Enterprise SKU ($15/1000) due to `TRAFFIC_ON_POLYLINE`, with only 1,000 free calls/month. This resulted in $100+ bills in March 2026. TomTom offers 2,500 free non-tile requests/day (~75,000/month) — enough for 5-minute polling at $0.

## Migration Tasks

### Phase 1: TomTom API Client
- [x] Create `src/lib/tomtom-traffic.ts` — replaces `google-traffic.ts`
  - Build TomTom Calculate Route request URL with circle waypoints, traffic, progress array
  - Parse response: extract encoded polyline (from leg), travel times, progress array
  - Compute per-segment congestion from progress array (divide route into N equal-distance segments)
  - Generate speed intervals from progress array for map coloring (replaces Google's `speedReadingIntervals`)
  - Export same `PollResult` interface for drop-in compatibility with scheduler/db
- [x] Increase segments from 5 to 8 for finer granularity

### Phase 2: Scheduler Update
- [x] Update `scheduler.ts` to import from `tomtom-traffic.ts` instead of `google-traffic.ts`
- [x] Restore 5-minute polling during active hours (5am–midnight PET)
  - Budget: 4 calls × 12/hr × 19h = 912/day (36% of 2,500 free tier)

### Phase 3: Map Rendering Compatibility
- [x] `TrafficMapInner.tsx` works with TomTom speed intervals — same `SpeedInterval` format
- [x] `@googlemaps/polyline-codec` decode works with TomTom encoded polylines (same algorithm, precision 5)
- [x] `map-utils.ts` `findUncoveredSegments` still works (same polyline comparison)

### Phase 4: Cleanup
- [x] Delete `google-traffic.ts`
- [x] Update `.env.example` — replace `GOOGLE_MAPS_API_KEY` with `TOMTOM_API_KEY`
- [x] Update `CLAUDE.md` — new data source, pricing, polling schedule
- [ ] Update `docs/data-pipeline.md` if needed
- [ ] Remove `GOOGLE_MAPS_API_KEY` from `.env` once confirmed working

### Phase 5: Validation
- [x] `npx next build` — zero errors
- [x] `npm test` — all 22 tests pass
- [x] Live API test — all 4 routes polled successfully with 8 segments each
- [ ] Verify map renders correctly with TomTom polylines + speed coloring (needs deploy)

## Key Design Decisions

### Progress Array → Speed Intervals

TomTom's `progress` array gives cumulative `travelTimeInSeconds` and `distanceInMeters` at polyline points. We derive speed between consecutive points:

```
speed = Δdistance / Δtime
freeFlowSpeed = totalDistance / noTrafficTravelTimeInSeconds
ratio = freeFlowSpeed / speed (clamped to ≥ 1.0)
congestionLevel = getCongestionLevel(ratio)
```

Then group consecutive points with the same congestion level into `SpeedInterval` objects for map rendering. This gives **finer granularity** than Google's 3-tier system (NORMAL/SLOW/TRAFFIC_JAM) — we get actual speeds mapped to our 5-tier system.

### Circle Waypoints for Route Anchoring

TomTom's `circle(lat,lng,radius)` waypoints are pass-through (like Google's `via: true`). They anchor routes through the correct corridor without creating stops or extra legs.

### Segment Count: 5 → 8

With the progress array we can use any segment count. 8 segments improves card/bar granularity while keeping UI readable. Segment IDs become `uchumayo-0` through `uchumayo-7`.

### Free-Flow Speed per Segment

TomTom gives `noTrafficTravelTimeInSeconds` at route level only. We distribute free-flow time proportionally by segment distance:

```
segFreeFlowTime = noTrafficTravelTime × (segDistance / totalDistance)
```

This is a reasonable approximation. Highway segments naturally get proportionally more free-flow time than urban ones because they're longer.
