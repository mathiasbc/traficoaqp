# Incident Data Pipeline

How TráficoAQP detects, stores, and displays road incidents (closures, accidents, police, construction) on the Arequipa ↔ Km 48 corridor.

## Current Status

**SUTRAN scraping is implemented and active.** The app polls SUTRAN's GIS alert system every 5 minutes and displays real incidents on the map. Mock incidents have been fully removed.

PROVIAS and COVISUR integrations are planned but not yet implemented (see roadmap sections below).

## Data Sources

### Source 1: SUTRAN — Alerta de Estado de Vía (Primary)

**What:** Peru's official real-time road alert system, operated by the Superintendencia de Transporte Terrestre.

**URL:** `https://gis.sutran.gob.pe/alerta_sutran/`

**Technology:** Leaflet.js frontend + PHP backend + Socket.IO for real-time pushes.

**Endpoints discovered:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `script_cgm/carga_xlsx.php` | POST (`tipo=1`) | Current alert data (map mode) |
| `script_cgm/carga_xlsx.php` | POST (`tipo=2`) | Alternative visualization |
| `script_cgm/carga_xlsx.php` | POST (`tipo=3`) | Another visualization mode |
| `popupAlerta.php` | GET (`prueba={id}&data={json}`) | Alert detail popup HTML |
| `ws://190.81.47.145:3001` | Socket.IO | Real-time broadcast of status changes |

**Data fields (from popup HTML):**

| Field | Example | Mapping |
|-------|---------|---------|
| Status | TRANSITO INTERRUMPIDO / RESTRINGIDO / NORMAL | → `severity` (critico / medio / bajo) |
| Fecha del evento | 28/02/2026 | → `reported_at` |
| Fecha de actualización | 15/03/2026 15:00 HORAS | → `updated_at` |
| Afectación | KM 24 + 900 | → segment matching by km marker |
| Carretera | CARRETERA REPARTICION AREQUIPA - SANTA LUCIA - JULIACA | → `route_id` matching |
| Ubigeo | AREQUIPA/AREQUIPA/UCHUMAYO | → geographic context |
| Coordenada | -16.42593, -71.675314 | → `lat`, `lng` |
| Evento | AFECTACION DE LOZA DE CONCRETO DEL PUENTE UCHUMAYO | → `title`, `description` |
| Fuente | PNP | → `source` |
| Vehículos detenidos | Pasajeros: 0, Mercancías: 0 | → `metadata` |

**Status mapping:**

| SUTRAN Status | Color | Our severity | Our type |
|---------------|-------|-------------|----------|
| TRANSITO INTERRUMPIDO | Red | `critico` | `cierre` |
| TRANSITO RESTRINGIDO | Yellow | `medio` | `obras` or `derrumbe` |
| TRANSITO NORMAL | Green | (ignore) | — |

**Polling:** Every 30 minutes via HTTP POST to `carga_xlsx.php`.

**Filtering:** Only incidents where coordinates fall within the bounding box of our two routes:
- Lat: -16.55 to -16.38
- Lng: -71.80 to -71.55

### Source 2: PROVIAS Nacional — ArcGIS REST API (Planned)

**What:** Peru's national road infrastructure authority. Operates a full ArcGIS server with queryable emergency layers.

**Server:** `https://giserver.proviasnac.gob.pe/arcgis/rest/services/`

**Key endpoints:**

**Emergency FeatureServer (current emergencies):**
```
GET https://giserver.proviasnac.gob.pe/arcgis/rest/services/SERV_PVN_EmergenciaVial/FeatureServer/0/query
  ?where=1=1
  &outFields=*
  &geometry=-71.80,-16.55,-71.55,-16.38
  &geometryType=esriGeometryEnvelope
  &inSR=4326
  &spatialRel=esriSpatialRelIntersects
  &f=json
```

**GEOVIAL Emergencies (richer descriptions):**
```
GET https://giserver.proviasnac.gob.pe/arcgis/rest/services/GEOVIAL/SERV_TI_PVN_RVN_EMERGENCIAS/MapServer/0/query
  ?where=longitud < -71.55 AND longitud > -71.80 AND latitud > -16.55 AND latitud < -16.38
  &outFields=*
  &f=json
```

**GEOVIAL response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id_emergencia_vial` | Integer | Emergency ID |
| `id_condicion_transito` | Integer | Transit condition code |
| `id_tipo_emergencia` | Integer | Emergency type code |
| `Descripcion` | String | Human-readable type (e.g. DERRUMBE, EROSION DE PLATAFORMA) |
| `id_ruta` | Integer | Route ID |
| `progresiva_ini` | String | Start km marker (e.g. "24+900") |
| `progresiva_fin` | String | End km marker |
| `latitud` | Double | Latitude |
| `longitud` | Double | Longitude |
| `estado` | Integer | Status code |
| `fecha_emergencia` | Date | Emergency date |

**Polling:** Every 30 minutes (same schedule as SUTRAN). Standard REST — no auth required.

**Type mapping:**

| PROVIAS Descripcion | Our type |
|--------------------|----------|
| DERRUMBE | `derrumbe` |
| EROSION DE PLATAFORMA / CALZADA | `derrumbe` |
| EMERGENCIA VEHICULAR | `accidente` |
| COLAPSO DE PLATAFORMA | `cierre` |
| DESBORDES DE RIOS | `clima` |

### Source 3: COVISUR — Comunicados (Planned)

**What:** The private concessionaire that directly operates the Arequipa–Km 48 highway.

**URL:** `https://covisur.com.pe/comunicados/`

**Format:** WordPress site. Try WP REST API first:
```
GET https://covisur.com.pe/wp-json/wp/v2/posts?per_page=10&search=uchumayo
```

If WP REST API is disabled, fall back to HTML scraping of `/comunicados/page/{N}/`.

**Polling:** Every 6 hours (posts are manual, low frequency).

**Value:** COVISUR posts are the most authoritative source for this specific corridor — they're the operator. They post closures, maintenance schedules, and detour information.

---

## SQLite Schema

```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,                -- "sutran-{hash}" or "provias-{id}" or "covisur-{post_id}"
  source TEXT NOT NULL,               -- "sutran", "provias", "covisur"
  source_id TEXT,                     -- Original ID from the source system
  route_id TEXT,                      -- "uchumayo", "cerro-verde", or NULL if unclear
  segment_id TEXT,                    -- "uchumayo-2", etc. (matched by coords/km)
  type TEXT NOT NULL,                 -- "accidente", "obras", "cierre", "policia", "clima", "derrumbe"
  severity TEXT NOT NULL,             -- "critico", "alto", "medio", "bajo"
  title TEXT NOT NULL,
  description TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  km_marker TEXT,                     -- "24+900" (from SUTRAN/PROVIAS)
  road_name TEXT,                     -- "CARRETERA REPARTICION AREQUIPA..."
  reported_at TEXT NOT NULL,          -- ISO 8601
  updated_at TEXT,                    -- Last update from source
  resolved_at TEXT,                   -- NULL if still active
  active INTEGER DEFAULT 1,          -- 1 = active, 0 = resolved
  raw_data TEXT,                      -- Full JSON from source (for debugging)
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);

CREATE INDEX idx_incidents_active ON incidents(active, route_id);
CREATE INDEX idx_incidents_source ON incidents(source, source_id);
CREATE INDEX idx_incidents_coords ON incidents(lat, lng);
```

---

## Polling Schedule

```
┌─ Every 30 minutes ─────────────────────────────────────────┐
│  1. POST to SUTRAN carga_xlsx.php (tipo=1)                  │
│     → Parse response, extract alerts in bounding box        │
│     → UPSERT into incidents table                           │
│                                                             │
│  2. GET PROVIAS FeatureServer query (Arequipa bbox)         │
│     → Parse ArcGIS JSON response                            │
│     → UPSERT into incidents table                           │
│                                                             │
│  3. Mark as resolved: incidents from these sources that     │
│     were NOT returned in this poll cycle → set active=0     │
└─────────────────────────────────────────────────────────────┘

┌─ Every 6 hours ────────────────────────────────────────────┐
│  4. GET COVISUR /wp-json/wp/v2/posts (or scrape HTML)      │
│     → Parse for closure/restriction keywords                │
│     → UPSERT into incidents table                           │
└─────────────────────────────────────────────────────────────┘
```

### Deduplication

Incidents from different sources may describe the same event (e.g. Puente Uchumayo closure reported by both SUTRAN and PROVIAS). Deduplication logic:

1. Each source gets a unique `id` prefix: `sutran-{hash}`, `provias-{id}`, `covisur-{post_id}`
2. The `UNIQUE(source, source_id)` constraint prevents duplicates from the same source
3. Cross-source deduplication: if two incidents from different sources are within 500m of each other AND have overlapping types, keep the one with higher severity and mark the other as a duplicate (add `duplicate_of` field if needed)
4. For now, showing both is acceptable — better to over-report than under-report

### Auto-resolution

- If a SUTRAN poll returns an alert as TRANSITO NORMAL (green) that was previously INTERRUMPIDO/RESTRINGIDO, set `active=0` and `resolved_at=now()`
- If a PROVIAS emergency disappears from the query results, set `active=0`
- COVISUR posts don't auto-resolve — require manual resolution or a follow-up post

---

## Segment Matching

When an incident arrives with coordinates, we need to assign it to one of our route segments.

**Algorithm:**

1. For each incident `(lat, lng)`, compute distance to every point in both path arrays (UCHUMAYO_PATH, CERRO_VERDE_PATH)
2. Find the nearest point → this tells us which route the incident is on
3. Determine which segment that point falls in (between which boundary coordinates)
4. If distance to nearest point > 1km, the incident is off our corridors → skip it

**Km marker matching (bonus):**

SUTRAN and PROVIAS provide km markers (e.g. "24+900"). Our segments have named boundaries that correspond to km markers:
- Km 24 = `uchumayo-2` / `uchumayo-3` boundary
- Km 36 = `uchumayo-3` / `uchumayo-4` boundary
- Km 48 = end point

Parse the km marker to assign directly when available, falling back to coordinate matching.

---

## API Route

### `GET /api/incidents`

Returns all active incidents.

**Response format:**

```json
[
  {
    "id": "sutran-a1b2c3",
    "source": "sutran",
    "routeId": "uchumayo",
    "segmentId": "uchumayo-2",
    "type": "cierre",
    "severity": "critico",
    "title": "Afectación de loza de concreto del Puente Uchumayo",
    "description": "Tránsito interrumpido en KM 24+900. Carretera Repartición Arequipa.",
    "coords": [-16.42593, -71.675314],
    "kmMarker": "24+900",
    "reportedAt": "2026-02-28T00:00:00-05:00",
    "updatedAt": "2026-03-15T15:00:00-05:00",
    "active": true
  }
]
```

### `GET /api/incidents?route=uchumayo`

Filter by route.

---

## Frontend Integration

### Incident markers on map

`TrafficMapInner.tsx` renders incident markers from real SUTRAN data fetched via `/api/incidents`. Mock incidents have been fully removed.

### Incident badges on route cards

`RoadSummary.tsx` shows an orange badge when `activeIncidentCount > 0`:

- 0 incidents → no badge (clean route)
- 1+ incidents → orange badge with count
- Any `critico` severity → red badge + `IncidentBanner` at top of page

### Closed road visualization

When a `critico` incident is active on a route, the app compares the static road path against Google's returned polyline. Portions of the old road that Google bypasses are rendered as **dashed gray lines** on the map. See `docs/route-data-model.md` → "Closed Road Detection" for details.

### Incident icons

| Type | Icon |
|------|------|
| `accidente` | 🚗 |
| `obras` | 🚧 |
| `cierre` | ⛔ |
| `policia` | 🚔 |
| `clima` | 🌧️ |
| `derrumbe` | ⚠️ |

---

## Bounding Box

All source queries are filtered to the corridor bounding box:

```
Southwest: [-16.55, -71.80]
Northeast: [-16.38, -71.55]
```

This covers both Vía Uchumayo and Vía Cerro Verde with margin.

---

## Files

| File | Status | Purpose |
|------|--------|---------|
| `src/lib/sutran-scraper.ts` | Implemented | SUTRAN PHP endpoint scraper + HTML parser |
| `src/lib/incident-matcher.ts` | Implemented | Coordinate → segment matching |
| `src/lib/map-utils.ts` | Implemented | Closed road detection (static path vs Google polyline) |
| `src/lib/db.ts` | Implemented | Incidents table + query helpers |
| `src/lib/scheduler.ts` | Implemented | 5-min incident poll job |
| `src/app/api/incidents/route.ts` | Implemented | GET endpoint for active incidents |
| `src/hooks/useTrafficData.ts` | Implemented | Fetches from /api/incidents |
| `src/components/TrafficMapInner.tsx` | Implemented | Renders real incidents + dashed gray closed roads |
| `src/lib/provias-client.ts` | Planned | PROVIAS ArcGIS REST client |
