# Route Data Model

How vias (routes) are defined, stored, and rendered in **TráficoAQP**.

## Coordinate System

All coordinates use **[latitude, longitude]** tuples (WGS84 / EPSG:4326) — the same system used by Leaflet, OpenStreetMap, and GPS devices.

```typescript
type Coordinate = [number, number]; // [lat, lng]
// Example: [-16.411156, -71.556356]  (Sachaca, Arequipa)
```

Latitude is negative (southern hemisphere), longitude is negative (western hemisphere).

## Architecture Overview

```
types.ts              — TypeScript interfaces (TrafficSegment, RouteConfig, RoutePolyline, etc.)
google-traffic.ts     — Google Maps API client, polyline decoder, equal-distance segment splitter
db.ts                 — SQLite: snapshots, hourly averages, route polylines
roads.ts              — Static segment definitions (fallback), route configs, shared constants
uchumayo-path.ts      — Static coordinate array for Vía Uchumayo (fallback only)
cerro-verde-path.ts   — Static coordinate array for Vía Cerro Verde (fallback only)
colors.ts             — Congestion colors and thresholds
```

## Dynamic Polylines (Primary)

The map renders **Google Maps' actual polyline** for each route, colored by `speedReadingIntervals`. This means the app automatically reflects real-world changes: road closures, detours, new infrastructure. Every 5-min poll updates the polyline.

Each route uses intermediate **pass-through** waypoints (`via: true`) to anchor it to the correct corridor. Google chooses the best actual path within that corridor (including any detours). See `docs/data-pipeline.md` for the waypoint coordinates.

The polyline + speed intervals are stored in the `route_polylines` table (4 rows total) and served to the frontend via the `/api/traffic/current` response.

## Static Path Files (Fallback)

When Google API data is unavailable (first startup, API failure), the map falls back to static path files. Each route has a dedicated path file exporting a coordinate array sampled at ~100m intervals from OSRM routing data.

```typescript
// uchumayo-path.ts
export const UCHUMAYO_PATH: [number, number][] = [
  [-16.411156, -71.556356], // Sachaca (start)
  [-16.410000, -71.557619],
  // ... ~200 points following the actual road geometry
  [-16.528782, -71.780655], // Km 48 (end)
];
```

These are **not** used for API data mapping — only for fallback rendering.

## Segments

### Dynamic segments (from Google polyline)

When API data is available, the 5 segments per route are derived by **equal-distance splitting** of Google's polyline:

1. Compute cumulative haversine distance along the decoded polyline
2. Split at 0%, 20%, 40%, 60%, 80%, 100% of total distance
3. For each virtual segment, compute weighted congestion from overlapping speed intervals

Segment IDs (`uchumayo-0` through `uchumayo-4`) represent the 1st through 5th equal-distance chunk. Labels are approximate geographic names defined in `SEGMENT_LABELS` in `google-traffic.ts`.

### Static segments (fallback)

Static `TrafficSegment` definitions in `roads.ts` provide fallback segment geometry:

```typescript
interface TrafficSegment {
  id: string;              // "uchumayo-0", "cerro-verde-2"
  routeId: RouteId;        // "uchumayo" | "cerro-verde"
  index: number;           // 0-based position within the route
  name: string;            // "Sachaca → Congata"
  distanceKm: number;      // Approximate distance
  baseMinutes: number;     // Free-flow travel time
  startCoords: [number, number];
  endCoords: [number, number];
  polyline: [number, number][];   // Sliced from static path file
}
```

These are only used when `route_polylines` table is empty (no Google data yet).

### Current Segments

**Vía Uchumayo** (5 segments):


| #   | Name               | Boundary Coords                                         |
| --- | ------------------ | ------------------------------------------------------- |
| 0   | Sachaca → Congata  | `[-16.411156, -71.556356]` → `[-16.406012, -71.591310]` |
| 1   | Congata → Uchumayo | `[-16.406012, -71.591310]` → `[-16.413862, -71.622096]` |
| 2   | Uchumayo → Km 24   | `[-16.413862, -71.622096]` → `[-16.443083, -71.689925]` |
| 3   | Km 24 → Km 36      | `[-16.443083, -71.689925]` → `[-16.509050, -71.743458]` |
| 4   | Km 36 → Km 48      | `[-16.509050, -71.743458]` → `[-16.528782, -71.780655]` |


**Vía Cerro Verde** (5 segments):


| #   | Name                         | Boundary Coords                                         |
| --- | ---------------------------- | ------------------------------------------------------- |
| 0   | Sachaca → Quebrada Honda     | `[-16.411156, -71.556356]` → `[-16.454894, -71.591390]` |
| 1   | Quebrada Honda → Cerro Verde | `[-16.454894, -71.591390]` → `[-16.512236, -71.631102]` |
| 2   | Cerro Verde → Desvío Sur     | `[-16.512236, -71.631102]` → `[-16.530412, -71.651632]` |
| 3   | Desvío Sur → Enlace Km 40    | `[-16.530412, -71.651632]` → `[-16.527041, -71.746291]` |
| 4   | Enlace Km 40 → Km 48         | `[-16.527041, -71.746291]` → `[-16.528782, -71.780655]` |


Both routes share the same start `[-16.411156, -71.556356]` and end `[-16.528782, -71.780655]`.

## Route Config

Each route has metadata in `ROUTE_CONFIG`:

```typescript
interface RouteConfig {
  routeId: RouteId;
  name: string;          // "Vía Uchumayo"
  shortName: string;     // "Uchumayo"
  icon: string;          // Emoji icon
  closed: boolean;       // If true, route is grayed out
  closureReason?: string;
  segments: TrafficSegment[];
}
```

## Map Rendering

The map component (`TrafficMapInner.tsx`) supports two rendering modes:

### Dynamic mode (primary)

When `polylines` data is available from the API, each `speedReadingInterval` from Google is rendered as its own colored `<Polyline>` segment. Colors map directly from Google's speed categories:

| Google Speed | Color | Visual |
| --- | --- | --- |
| `NORMAL` | `#10b981` (green) | Free flow |
| `SLOW` | `#f59e0b` (amber) | Moderate congestion |
| `TRAFFIC_JAM` | `#dc2626` (red) | Heavy congestion |

A faint shadow polyline in the route's theme color is drawn underneath for route identity. Only the `salida` direction polyline is shown on the map to avoid visual clutter (both directions share the same physical road).

### Fallback mode

When no polyline data is available, the map falls back to rendering static segments from `ALL_SEGMENTS` with colors from the 5-level congestion system:

| Congestion Level | Color | Ratio Threshold |
| --- | --- | --- |
| `libre` | `#10b981` (green) | ratio ≤ 1.2 |
| `moderado` | `#f59e0b` (amber) | ratio ≤ 1.8 |
| `alto` | `#f97316` (orange) | ratio ≤ 2.5 |
| `muy_alto` | `#f43f5e` (rose) | ratio ≤ 3.5 |
| `colapsado` | `#dc2626` (red) | ratio > 3.5 |


## How to Add a New Route

### 1. Register the route type

Add the new route ID to the `RouteId` union in `types.ts`:

```typescript
export type RouteId = "uchumayo" | "cerro-verde" | "my-route";
```

### 2. Define waypoints in `google-traffic.ts`

Add intermediate pass-through waypoints to anchor the route to the correct corridor:

```typescript
const MY_ROUTE_WAYPOINTS: LatLng[] = [
  { latitude: -16.xxx, longitude: -71.xxx },
];
```

Add the waypoints to `buildRequestBody()`.

### 3. Add segment labels in `google-traffic.ts`

Add 5 geographic labels for the equal-distance segments:

```typescript
SEGMENT_LABELS["my-route"] = [
  "Start – Waypoint A",
  "Waypoint A – Waypoint B",
  "Waypoint B – Midpoint",
  "Midpoint – Waypoint C",
  "Waypoint C – End",
];
```

### 4. Create a fallback path file

Generate an OSRM path file for fallback rendering (when API data is unavailable). This is optional but recommended.

### 5. Define static fallback segments in `roads.ts`

Add segment definitions and `ROUTE_CONFIG` entry for fallback rendering.

### 6. Configure mock traffic in `mock-data.ts`

Add entries to `SEGMENT_FACTORS`, `ROUTE_FACTORS`, and `ROUTE_PEAK_BOOST`.

### 7. Recalculate the Google API budget

Each new route adds 2 calls/cycle (salida + ingreso) → +8,640 calls/month. At 5-min intervals, the absolute max is 4 routes before exceeding the $200/month free tier.

## Common Pitfalls

- **Waypoint too close to closure**: If a pass-through waypoint is AT a closure point, Google may return `ZERO_RESULTS`. Place waypoints before/after known problem areas.
- **Coordinate order**: Path arrays use `[lat, lng]`. Google Maps API uses `{latitude, longitude}`. OSRM uses `lng,lat`. Don't mix them.
- **Shared start/end points**: Both current routes share the same origin (Sachaca) and destination (Km 48). New routes should use the same endpoints if they serve the same corridor.

