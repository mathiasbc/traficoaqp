# Data Pipeline & Storage Architecture

How TráficoAQP pulls, stores, and serves real traffic data.

## Overview

```
Google Maps Routes API  ──(every 5 min)──►  SQLite  ──►  Next.js API routes  ──►  Frontend
                                              │
                                   20 days of snapshots (~45 MB)
                                   hourly averages (learned patterns)
```

The app polls Google Maps every 5 minutes for each route and direction, stores raw snapshots in SQLite (20 days retained), and serves data to the frontend via API routes. After a few days of collection, learned hourly patterns replace the hardcoded multipliers.

---

## Data Source: Google Maps Routes API

### Why Google Maps

- Confirmed segment-level traffic data for Arequipa, Peru
- Free tier: **$200/month credit** → ~40,000 requests/month
- We need ~34,560 requests/month (2 routes × 2 directions × 12 polls/hour × 24h × 30 days)
- Returns real-time speed classifications mapped to the route polyline

### Request

```
POST https://routes.googleapis.com/directions/v2:computeRoutes
Headers:
  X-Goog-Api-Key: YOUR_KEY
  X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline,routes.travelAdvisory,routes.legs.steps

Body:
{
  "origin": {
    "location": { "latLng": { "latitude": -16.411156, "longitude": -71.556356 } }
  },
  "destination": {
    "location": { "latLng": { "latitude": -16.528782, "longitude": -71.780655 } }
  },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE",
  "extraComputations": ["TRAFFIC_ON_POLYLINE"],
  "polylineQuality": "HIGH_QUALITY"
}
```

For **ingreso** direction, swap origin and destination.

Both routes use intermediate **pass-through** waypoints (`via: true`) to anchor the route to the correct corridor while letting Google choose the best actual path (including any detours around closures):

**Vía Uchumayo** — two waypoints before the Km 24 bridge area:

```json
"intermediates": [
  { "location": { "latLng": { "latitude": -16.406012, "longitude": -71.591310 } }, "via": true },
  { "location": { "latLng": { "latitude": -16.413862, "longitude": -71.622096 } }, "via": true }
]
```

**Vía Cerro Verde** — one waypoint at the mine:

```json
"intermediates": [
  { "location": { "latLng": { "latitude": -16.512236, "longitude": -71.631102 } }, "via": true }
]
```

Pass-through waypoints do not create separate legs — the response contains a single route with a single polyline. This is critical: the app renders whatever route Google returns, including detours around closures. When a road reopens, Google automatically routes through it — zero code changes needed.

### Response (relevant fields)

```json
{
  "routes": [{
    "duration": "2820s",
    "distanceMeters": 48200,
    "polyline": { "encodedPolyline": "..." },
    "travelAdvisory": {
      "speedReadingIntervals": [
        {
          "startPolylinePointIndex": 0,
          "endPolylinePointIndex": 42,
          "speed": "NORMAL"
        },
        {
          "startPolylinePointIndex": 42,
          "endPolylinePointIndex": 89,
          "speed": "SLOW"
        },
        {
          "startPolylinePointIndex": 89,
          "endPolylinePointIndex": 156,
          "speed": "TRAFFIC_JAM"
        }
      ]
    },
    "legs": [{
      "steps": [
        { "distanceMeters": 4200, "staticDuration": "480s" },
        { "distanceMeters": 5100, "staticDuration": "600s" }
      ]
    }]
  }]
}
```

### Dynamic polyline rendering (map)

The map renders Google's **actual polyline** colored by speed intervals — exactly like Google Maps does:

1. Decode the `encodedPolyline` into `[lat, lng][]` coordinates
2. For each `speedReadingInterval`, slice the polyline from `startIndex` to `endIndex`
3. Color each slice: NORMAL → green, SLOW → amber, TRAFFIC_JAM → red

The polyline + speed intervals are stored in the `route_polylines` table (4 rows, one per route-direction) and served to the frontend via the API. When API data is unavailable, the map falls back to static path files.

### Equal-distance segment splitting (cards)

For the 5-segment summary cards, the polyline is split into 5 equal-distance segments:

1. Compute cumulative haversine distance along the decoded polyline
2. Find the polyline indices at 0%, 20%, 40%, 60%, 80%, 100% of total distance
3. For each segment, compute weighted congestion from overlapping speed intervals
4. Derive estimated minutes proportionally from total route duration

**Speed classification → congestion ratio:**

| Google Speed | Congestion Ratio | Our Level |
|-------------|-----------------|-----------|
| `NORMAL` | ~1.0 | `libre` |
| `SLOW` | ~1.8 | `moderado` / `alto` |
| `TRAFFIC_JAM` | ~3.0+ | `muy_alto` / `colapsado` |

Segment IDs (`uchumayo-0` through `uchumayo-4`) represent the 1st through 5th equal-distance chunk of whatever route Google returns. Names are approximate geographic labels.

**Implementation:** `src/lib/google-traffic.ts` handles API calls, polyline decoding, equal-distance splitting, and snapshot generation.

---

## SQLite Storage

Using **`better-sqlite3`** — synchronous, fast, zero-config, ideal for Next.js.

Database file: `data/traffic.db` (gitignored, auto-created on first run).

### Schema

**`traffic_snapshots`** — Raw readings every 5 min

```sql
CREATE TABLE traffic_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id TEXT NOT NULL,        -- "uchumayo-0", "cerro-verde-2"
  route_id TEXT NOT NULL,          -- "uchumayo", "cerro-verde"
  direction TEXT NOT NULL,         -- "salida", "ingreso"
  timestamp TEXT NOT NULL,         -- ISO 8601 UTC
  hour INTEGER NOT NULL,           -- 0-23 (Peru local hour, for fast grouping)
  day_type TEXT NOT NULL,          -- "weekday", "saturday", "sunday"
  current_speed_kmh REAL,
  free_flow_speed_kmh REAL,
  estimated_minutes REAL,
  congestion_ratio REAL,
  congestion_level TEXT,           -- "libre", "moderado", etc.
  source TEXT DEFAULT 'google',
  UNIQUE(segment_id, direction, timestamp)
);

CREATE INDEX idx_snapshots_time ON traffic_snapshots(timestamp);
CREATE INDEX idx_snapshots_lookup ON traffic_snapshots(segment_id, direction, hour, day_type);
```

**`route_polylines`** — Latest Google polyline per route-direction (4 rows total)

```sql
CREATE TABLE route_polylines (
  route_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  encoded_polyline TEXT NOT NULL,
  speed_intervals_json TEXT NOT NULL,
  total_duration_sec INTEGER,
  total_distance_m INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(route_id, direction)
);
```

Updated every 5-min poll via `INSERT OR REPLACE`. The frontend uses this to render speed-colored polylines on the map. Size: ~20 KB total (trivial).

**`hourly_averages`** — Computed from snapshots, refreshed daily

```sql
CREATE TABLE hourly_averages (
  segment_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  day_type TEXT NOT NULL,          -- "weekday", "saturday", "sunday"
  hour INTEGER NOT NULL,           -- 0-23
  avg_congestion_ratio REAL,
  avg_speed_kmh REAL,
  avg_minutes REAL,
  sample_count INTEGER,
  updated_at TEXT,
  PRIMARY KEY(segment_id, direction, day_type, hour)
);
```

**Implementation:** `src/lib/db.ts` manages the connection, schema migration, and all query helpers.

### Data retention & storage estimate

- **Snapshots**: Keep **20 days**, auto-purge older rows daily
- **Hourly averages**: Overwritten on each recomputation, kept indefinitely

**Storage math (20 days at 5-min intervals):**

| Metric | Value |
|--------|-------|
| Rows per snapshot | 20 (10 segments × 2 directions) |
| Snapshots per day | 288 (12/hour × 24h) |
| Rows per day | 5,760 |
| Rows at 20 days | **115,200** |
| Avg row size (data + B-tree overhead) | ~250 bytes |
| Data size | **~29 MB** |
| Indexes (3 total) | **~16 MB** |
| `hourly_averages` table (1,440 rows) | **~0.3 MB** |
| **Total database size** | **~45 MB** |

45 MB is negligible — fits easily in memory and on any disk.

### Recomputation query

Run once daily at 03:00 Peru time:

```sql
INSERT OR REPLACE INTO hourly_averages
  (segment_id, direction, day_type, hour, avg_congestion_ratio, avg_speed_kmh, avg_minutes, sample_count, updated_at)
SELECT
  segment_id, direction, day_type, hour,
  AVG(congestion_ratio),
  AVG(current_speed_kmh),
  AVG(estimated_minutes),
  COUNT(*),
  datetime('now')
FROM traffic_snapshots
WHERE timestamp > datetime('now', '-20 days')
GROUP BY segment_id, direction, day_type, hour;
```

---

## Polling Schedule

Using **`node-cron`** running inside the Next.js server process, started via `src/instrumentation.ts`.

```
┌─ Every 5 minutes ──────────────────────────────────────────┐
│  For each (route, direction):                               │
│    1. POST to Google Maps Routes API (with via waypoints)   │
│    2. Decode polyline, parse speedReadingIntervals           │
│    3. Split polyline into 5 equal-distance segments          │
│    4. INSERT snapshots into traffic_snapshots                │
│    5. UPSERT polyline + intervals into route_polylines       │
│                                                             │
│  4 API calls per cycle (2 routes × 2 directions)            │
│  ~1,152 calls/day, ~34,560 calls/month                      │
│  Within $200/month free tier (limit: ~40,000)               │
│  Budget headroom: ~5,400 calls/month spare                  │
└─────────────────────────────────────────────────────────────┘

┌─ Daily at 03:00 PET ───────────────────────────────────────┐
│  1. Recompute hourly_averages from last 20 days             │
│  2. DELETE snapshots older than 20 days                     │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:** `src/lib/scheduler.ts` defines the cron jobs. `src/instrumentation.ts` calls `startScheduler()` once on server boot.

---

## API Routes

### `GET /api/traffic/current`

Returns the latest traffic states and route polylines.

**Fallback chain (for states):**
1. Query latest snapshot per (segment_id, direction) where timestamp < 10 min ago
2. If stale → return hourly_averages for current hour + day_type
3. If no data at all → fall back to mock generation (`generateTrafficState()`)

**Response format:**

```json
{
  "states": [
    {
      "segmentId": "uchumayo-0",
      "direction": "salida",
      "timestamp": "2026-03-14T16:10:00Z",
      "currentSpeedKmh": 45,
      "freeFlowSpeedKmh": 60,
      "estimatedMinutes": 11,
      "congestionLevel": "moderado",
      "congestionRatio": 1.33,
      "reportCount": 0
    }
  ],
  "polylines": [
    {
      "routeId": "uchumayo",
      "direction": "salida",
      "encodedPolyline": "...",
      "speedIntervals": [
        { "startPolylinePointIndex": 0, "endPolylinePointIndex": 42, "speed": "NORMAL" }
      ],
      "totalDurationSec": 4740,
      "totalDistanceM": 43400,
      "updatedAt": "2026-03-14T16:10:00Z"
    }
  ]
}
```

The `polylines` array contains the latest Google Maps polyline per route-direction. The frontend uses these to render speed-colored routes on the map. If no polylines are available, the map falls back to static path files.

### `GET /api/traffic/current?hour=14`

When the time simulator is active, returns the historical average for that hour instead of live data. Queries `hourly_averages` table, falls back to mock if empty.

### `GET /api/traffic/patterns`

Returns hourly averages for the pattern charts (replaces `generateHourlyPatterns()`).

**Response format** (matches existing `HourlyPattern[]`):

```json
[
  {
    "hour": 7,
    "dayType": "weekday",
    "routeId": "uchumayo",
    "direction": "salida",
    "avgCongestionRatio": 2.45,
    "avgTotalMinutes": 68
  }
]
```

**Implementation:** `src/app/api/traffic/current/route.ts` and `src/app/api/traffic/patterns/route.ts`.

---

## Frontend Integration

### Hook changes (`useTrafficData.ts`)

```
fetch('/api/traffic/current') → { states, polylines } → components
FALLBACK: If fetch fails → generateTrafficState() (graceful degradation, no polylines)
```

- Live mode: `fetch('/api/traffic/current')` every 60 seconds → returns `{ states, polylines }`
- Simulator mode: `fetch('/api/traffic/current?hour=14')` → returns `{ states, polylines }` (polylines are latest, states are hourly averages)
- Patterns: `fetch('/api/traffic/patterns')` once on mount → feeds `HourlyChart`
- Map: receives `polylines` array → renders Google's actual route colored by speed intervals (live mode) or a single worst-congestion color per route (simulator mode)
- Cards: receive `states` → 5 segments per route-direction (from equal-distance polyline splits)
- Direction toggle: user switches between "Salida" and "Ingreso" — the map filters polylines by the selected direction
- Incidents: `fetch('/api/incidents')` → real SUTRAN alerts rendered as markers on the map

### Graceful degradation

The frontend never breaks. If the API is unreachable or the database is empty, the existing mock data generator (`generateTrafficState()`) serves as the fallback. The user sees the same UI regardless of data source.

---

## Accuracy Improvement Over Time

### Week 1 (bootstrap)

- Google Maps data populates SQLite every 5 minutes
- `hourly_averages` table is sparse (partial coverage)
- Fallback to hardcoded multipliers fills gaps

### Week 2+ (learned patterns)

- `hourly_averages` has real data for all 24 hours × 3 day types × 10 segments × 2 directions
- Hardcoded multipliers no longer needed
- Real variance from data replaces random jitter
- Weekend vs weekday patterns reflect actual Arequipa traffic

### Cross-route inference

When Uchumayo shows high congestion, Cerro Verde likely sees overflow. The system can apply a spillover factor:

```
If uchumayo avg_ratio > 2.5 for current hour:
  cerro_verde_boost = 1 + (uchumayo_ratio - 2.5) * 0.3
```

### Holiday awareness

Peru holidays (Fiestas Patrias, Semana Santa, etc.) produce unique patterns. Tag `day_type` as `"holiday"` in snapshots taken on those dates. After one year, the system has learned holiday-specific patterns.

---

## Files Summary

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | SQLite connection, schema migration, query helpers |
| `src/lib/google-traffic.ts` | Google Maps API client, polyline decoder, segment mapper |
| `src/lib/scheduler.ts` | `node-cron` jobs: 5-min poll + daily recomputation |
| `src/instrumentation.ts` | Starts scheduler on Next.js server boot |
| `src/app/api/traffic/current/route.ts` | Current traffic endpoint (live + simulated) |
| `src/app/api/traffic/patterns/route.ts` | Hourly patterns endpoint |
| `src/hooks/useTrafficData.ts` | Frontend hook — fetches API, falls back to mock |
| `src/lib/mock-data.ts` | Permanent fallback data source (unchanged) |
| `data/traffic.db` | SQLite database file (auto-created, gitignored) |
