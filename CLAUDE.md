# CLAUDE.md — TráficoAQP

## Project Identity

**TráficoAQP** is a free, open-source community project providing real-time traffic monitoring for interprovincial routes in Arequipa, Peru. The corridor currently covers Arequipa ↔ Km 48 (La Repartición) via two routes: Vía Uchumayo and Vía Cerro Verde. The goal is to expand coverage to other corridors in the Arequipa region and potentially across Peru.

This is not a commercial product. It serves the Arequipa community with accurate, transparent traffic data. Quality and data accuracy are non-negotiable.

## Your Role

You are a **senior software engineer** responsible for:

- High-quality, production-grade code
- Highly accurate data visualization — every polyline, every congestion color, every travel time must reflect real road conditions
- Clean architecture with small, focused components
- Zero dead code — if it's unused, delete it

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4 |
| Map | Leaflet + react-leaflet |
| Charts | Recharts |
| Icons | Lucide React + emoji |
| Data source | TomTom Routing API (polled every 5 min, 5am–midnight PET) |
| Database | SQLite via better-sqlite3 (local file: `data/traffic.db`) |
| Scheduler | node-cron (in-process, started via Next.js instrumentation hook) |
| Fallback | Client-side mock generation (`mock-data.ts`) when DB is empty or API fails |
| Timezone | America/Lima (UTC-5) |
| Locale | Spanish (es-PE) |

## Project Structure

```
trafico-aqp/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, font, Leaflet CSS
│   │   ├── page.tsx                # Main page, orchestrates all sections
│   │   ├── globals.css             # Global styles, Leaflet overrides
│   │   └── api/
│   │       ├── traffic/current/route.ts    # GET /api/traffic/current — live + simulated data
│   │       ├── traffic/patterns/route.ts   # GET /api/traffic/patterns — hourly averages
│   │       └── incidents/route.ts          # GET /api/incidents — active road incidents
│   ├── components/                 # UI components (one purpose each)
│   │   ├── TrafficMap.tsx          # Dynamic import wrapper (SSR disabled)
│   │   ├── TrafficMapInner.tsx     # Leaflet map with polylines + markers
│   │   ├── RoadSummary.tsx         # Route card (time, congestion, badges)
│   │   ├── CongestionBadge.tsx     # Colored congestion level badge
│   │   ├── SegmentBar.tsx          # Horizontal colored segment display
│   │   ├── HourlyChart.tsx         # Recharts bar chart for patterns
│   │   ├── IncidentBanner.tsx      # Critical incident alert banner
│   │   └── TimeSimulator.tsx       # Hour slider for time simulation
│   ├── hooks/
│   │   └── useTrafficData.ts       # Core data hook (fetches API, falls back to mock)
│   ├── lib/
│   │   ├── types.ts                # ALL TypeScript interfaces and types
│   │   ├── colors.ts               # Theme colors, congestion thresholds
│   │   ├── roads.ts                # Segment definitions, route configs, constants
│   │   ├── traffic.ts              # Route summary calculation, formatting utils
│   │   ├── db.ts                   # SQLite connection, schema, query helpers
│   │   ├── tomtom-traffic.ts        # TomTom Routing API client, progress array parser
│   │   ├── sutran-scraper.ts       # SUTRAN GIS alert scraper
│   │   ├── incident-matcher.ts     # Coordinate → route/segment matching
│   │   ├── map-utils.ts            # Closed road detection (static vs Google path)
│   │   ├── scheduler.ts            # node-cron jobs: 5-min poll via TomTom + daily recomputation
│   │   ├── mock-data.ts            # Mock traffic generation (permanent fallback)
│   │   ├── uchumayo-path.ts        # Coordinate array for Vía Uchumayo
│   │   ├── cerro-verde-path.ts     # Coordinate array for Vía Cerro Verde
│   │   └── __tests__/              # Vitest test files
│   └── instrumentation.ts          # Starts scheduler on server boot
├── data/
│   ├── traffic.db                  # SQLite database (auto-created, gitignored)
│   └── .gitkeep
├── docs/
│   ├── route-data-model.md         # How routes are defined and rendered
│   ├── data-pipeline.md            # API polling, SQLite storage, accuracy plan
│   ├── incidents.md                # Incident data sources, scraping, matching
│   └── deployment.md               # Self-hosted MacBook + Cloudflare Tunnel setup
├── .env                            # GOOGLE_MAPS_API_KEY (gitignored)
├── .env.example                    # Template for environment variables
├── vitest.config.ts                # Test configuration
└── package.json
```

## Architecture Rules

### Components

- **One component, one job.** A component renders one piece of UI. If it does two things, split it.
- Keep components small — under 100 lines is ideal, 150 is the upper limit.
- No business logic in components. Data flows from hooks; components render it.
- Use `interface` for props, not inline types.

### Data Layer

- **Types** go in `src/lib/types.ts`. One file for all interfaces and type aliases. Never scatter types across files.
- **Static data** (coordinates, segment definitions, route configs, color maps) go in `src/lib/`. These are pure data, no side effects.
- **Path files** (`uchumayo-path.ts`, `cerro-verde-path.ts`) are standalone coordinate arrays — fallback only when Google API data is unavailable. The primary map rendering uses Google's dynamic polylines.
- **Server-only modules** (`db.ts`, `google-traffic.ts`, `scheduler.ts`) run only on the Node.js server. Never import them from client components.
- **Hooks** handle data fetching, state management, and computation. Components consume hooks, never the reverse.

### Data Flow

```
TomTom API → scheduler.ts → db.ts (SQLite: snapshots + polylines) → API routes → useTrafficData.ts → components
                                                                                           ↓ (on error)
                                                                                     mock-data.ts (fallback)
```

The API returns both traffic states (5 segments per route-direction) and route polylines (encoded polyline + speed intervals). The map renders Google's dynamic polyline; the cards use the 5-segment split.

### Route Visibility

- **Both routes always visible.** Vía Uchumayo and Vía Cerro Verde must always appear on the map, regardless of closures or incidents. Never hide a route.
- Google-returned polylines always render with **normal speed colors** — they represent the actual route drivers use (including any detours).
- If a route has an active critical incident (`severity === "critico"`), render the **closed portion of the old static road** (from the incident point to Km 48) as a **dashed gray line**. The Google polyline stays speed-colored; the dashed gray shows the road segment that is no longer reachable via that corridor.
- The incident marker on the map provides visual context for why the section is closed.

### Code Hygiene

- **Delete unused code immediately.** No commented-out blocks, no dead imports, no orphan functions.
- Run `npx next build` after every change to verify zero errors.
- Prefer explicit types over `any`. Never use `any`.
- All UI text is in Spanish (es-PE locale).

## TomTom Routing API

The app uses the TomTom Calculate Route API for real-time traffic data. Migrated from Google Maps Routes API in March 2026 due to pricing (Google's Enterprise SKU gave only 1,000 free calls/month, TomTom gives 2,500/day).

**Pricing:** TomTom free tier: **2,500 non-tile requests/day** (~75,000/month). No credit card required. Commercial use OK. Overage: $0.75/1000 (vs Google's $15/1000).

**Our usage:** 4 calls every 5 minutes, 5am–midnight Peru time (19h/day). Budget: 4 × 12/hr × 19h = **912 calls/day** (36% of free tier). **$0 cost.**

**Critical limits:**
- Free tier is 2,500/day — current usage is 912/day, ample headroom
- Each new route adds 2 calls/cycle → +228/day at 5-min/19h (can support ~6 routes before hitting limit)
- The API key must be stored in `.env` as `TOMTOM_API_KEY` (gitignored), never committed
- Do NOT reduce polling interval below 5 min without checking daily budget

**Dynamic polylines:** TomTom returns an encoded polyline (same format as Google, precision 5) and a `progress` array with cumulative `travelTimeInSeconds` and `distanceInMeters` at polyline points. Speed between points is derived as `Δdistance/Δtime`, mapped to our 5-tier congestion system. Circle waypoints (`circle(lat,lng,radius)`) anchor routes through the correct corridor without creating legs.

**Card segments:** The route is split into 8 equal-distance segments using the progress array. Per-segment congestion ratio = `freeFlowSpeed / currentSpeed`, where free-flow time is distributed proportionally by distance from the route's `noTrafficTravelTimeInSeconds`. Segment IDs are `uchumayo-0` through `uchumayo-7`.

See `docs/data-pipeline.md` for the full mapping, `docs/route-data-model.md` for the segment model, and `docs/tomtom-migration.md` for migration details.

## Deployment

Self-hosted on a MacBook in Arequipa, exposed via Cloudflare Tunnel.

**Stack:**
- MacBook running macOS, always plugged in, sleep disabled via `pmset`
- `next build && next start` managed by `launchd` (auto-restart on crash/reboot)
- `cloudflared` tunnel service (installed as macOS system service) exposes port 3000 to the internet
- Cloudflare provides free HTTPS, CDN caching, DDoS protection
- Domain: configured via Cloudflare DNS

**Why self-hosted:** The data pipeline uses `better-sqlite3` (local file) and `node-cron` (persistent process), which require a long-running server. Serverless platforms (Vercel, Cloudflare Workers) cannot support this architecture. Self-hosting on a MacBook in Arequipa gives zero platform costs, zero row/read limits, best latency for local users, and the simplest possible architecture.

See `docs/deployment.md` for full setup instructions (macOS, launchd, Cloudflare Tunnel, monitoring).

## Documentation

Read these before making changes to the data layer:

| Document | What it covers |
|----------|---------------|
| `docs/route-data-model.md` | Coordinate system, path files, segment definitions, boundary matching, how to add new routes |
| `docs/data-pipeline.md` | Google Maps API integration, SQLite schema, polling schedule, accuracy plan |
| `docs/incidents.md` | Incident data sources (SUTRAN, PROVIAS, COVISUR), scraping, segment matching, dedup |
| `docs/deployment.md` | Self-hosted MacBook setup, Cloudflare Tunnel, launchd, monitoring, backups |

## Coordinate System

All coordinates are **[latitude, longitude]** tuples (WGS84). Latitude is negative (south), longitude is negative (west).

```typescript
[-16.411156, -71.556356]  // Sachaca, Arequipa
```

**Warning:** OSRM and Google Maps APIs use **lng,lat** order in URLs. Our internal arrays use **lat,lng**. Never mix them.

## Congestion System

| Level | Color | Ratio |
|-------|-------|-------|
| `libre` | green (#10b981) | ≤ 1.2 |
| `moderado` | amber (#f59e0b) | ≤ 1.8 |
| `alto` | orange (#f97316) | ≤ 2.5 |
| `muy_alto` | rose (#f43f5e) | ≤ 3.5 |
| `colapsado` | red (#dc2626) | > 3.5 |

The congestion ratio is `freeFlowSpeed / currentSpeed`. A ratio of 1.0 means free flow. Higher is worse.

## Common Tasks

### Adding a new route
Follow the step-by-step guide in `docs/route-data-model.md` → "How to Add a New Route". Remember to recalculate the Google API budget.

### Modifying a path
Edit the path file directly. Ensure all boundary coordinates still exist exactly in the array after changes.

### Changing congestion thresholds
Edit `getCongestionLevel()` in `src/lib/colors.ts`. The thresholds cascade to all components automatically.

### Running the dev server
```bash
npm run dev --prefix trafico-aqp
```
Port 3000. The scheduler starts automatically via the instrumentation hook.

### Running tests
```bash
npm test --prefix trafico-aqp
```

### Running production
```bash
npm run build --prefix trafico-aqp
npm run start --prefix trafico-aqp
```
