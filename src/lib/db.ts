import Database from "better-sqlite3";
import path from "path";
import type { CongestionLevel, Direction, RouteId, RoutePolyline, SpeedInterval, IncidentSource, IncidentType, IncidentSeverity } from "./types";
import { getCongestionLevel } from "./colors";

// ── Types ──

export interface IncidentRow {
  id: string;
  source: IncidentSource;
  source_id: string | null;
  route_id: string | null;
  segment_id: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  km_marker: string | null;
  reported_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  active: number;
}

export interface SnapshotRow {
  segment_id: string;
  route_id: string;
  direction: Direction;
  timestamp: string;
  hour: number;
  day_type: "weekday" | "saturday" | "sunday";
  current_speed_kmh: number;
  free_flow_speed_kmh: number;
  estimated_minutes: number;
  congestion_ratio: number;
  congestion_level: CongestionLevel;
}

export interface HourlyAverageRow {
  segment_id: string;
  direction: Direction;
  day_type: "weekday" | "saturday" | "sunday";
  hour: number;
  avg_congestion_ratio: number;
  avg_speed_kmh: number;
  avg_minutes: number;
  sample_count: number;
}

// ── Connection ──

const DB_PATH = path.join(process.cwd(), "data", "traffic.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  migrate(_db);
  return _db;
}

// ── Schema Migration ──

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS traffic_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      segment_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      hour INTEGER NOT NULL,
      day_type TEXT NOT NULL,
      current_speed_kmh REAL,
      free_flow_speed_kmh REAL,
      estimated_minutes REAL,
      congestion_ratio REAL,
      congestion_level TEXT,
      source TEXT DEFAULT 'google',
      UNIQUE(segment_id, direction, timestamp)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_time
      ON traffic_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
      ON traffic_snapshots(segment_id, direction, hour, day_type);

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT,
      route_id TEXT,
      segment_id TEXT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      km_marker TEXT,
      reported_at TEXT NOT NULL,
      updated_at TEXT,
      resolved_at TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_active
      ON incidents(active, route_id);

    CREATE TABLE IF NOT EXISTS route_polylines (
      route_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      encoded_polyline TEXT NOT NULL,
      speed_intervals_json TEXT NOT NULL,
      total_duration_sec INTEGER,
      total_distance_m INTEGER,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(route_id, direction)
    );

    CREATE TABLE IF NOT EXISTS hourly_averages (
      segment_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      day_type TEXT NOT NULL,
      hour INTEGER NOT NULL,
      avg_congestion_ratio REAL,
      avg_speed_kmh REAL,
      avg_minutes REAL,
      sample_count INTEGER,
      updated_at TEXT,
      PRIMARY KEY(segment_id, direction, day_type, hour)
    );
  `);
}

// ── Helpers ──

function getPeruTime(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Lima" })
  );
}

export function getDayType(date?: Date): "weekday" | "saturday" | "sunday" {
  const d = date ?? getPeruTime();
  const day = d.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

export function getPeruHour(date?: Date): number {
  const d = date ?? getPeruTime();
  return d.getHours();
}

// ── Queries ──

export function insertSnapshots(rows: SnapshotRow[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO traffic_snapshots
      (segment_id, route_id, direction, timestamp, hour, day_type,
       current_speed_kmh, free_flow_speed_kmh, estimated_minutes,
       congestion_ratio, congestion_level)
    VALUES
      (@segment_id, @route_id, @direction, @timestamp, @hour, @day_type,
       @current_speed_kmh, @free_flow_speed_kmh, @estimated_minutes,
       @congestion_ratio, @congestion_level)
  `);

  const insertMany = db.transaction((items: SnapshotRow[]) => {
    for (const item of items) stmt.run(item);
  });

  insertMany(rows);
}

export function getLatestSnapshots(): SnapshotRow[] {
  const db = getDb();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  return db.prepare(`
    SELECT s.*
    FROM traffic_snapshots s
    INNER JOIN (
      SELECT segment_id, direction, MAX(timestamp) as max_ts
      FROM traffic_snapshots
      WHERE timestamp > ?
      GROUP BY segment_id, direction
    ) latest
    ON s.segment_id = latest.segment_id
      AND s.direction = latest.direction
      AND s.timestamp = latest.max_ts
  `).all(tenMinAgo) as SnapshotRow[];
}

export function getHourlyAverages(
  hour: number,
  dayType: "weekday" | "saturday" | "sunday"
): HourlyAverageRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM hourly_averages WHERE hour = ? AND day_type = ?
  `).all(hour, dayType) as HourlyAverageRow[];
}

export function getAllHourlyAverages(): HourlyAverageRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM hourly_averages").all() as HourlyAverageRow[];
}

export function recomputeAverages(): void {
  const db = getDb();
  db.exec(`
    INSERT OR REPLACE INTO hourly_averages
      (segment_id, direction, day_type, hour,
       avg_congestion_ratio, avg_speed_kmh, avg_minutes,
       sample_count, updated_at)
    SELECT
      segment_id, direction, day_type, hour,
      AVG(congestion_ratio),
      AVG(current_speed_kmh),
      AVG(estimated_minutes),
      COUNT(*),
      datetime('now')
    FROM traffic_snapshots
    WHERE timestamp > datetime('now', '-20 days')
    GROUP BY segment_id, direction, day_type, hour
  `);
}

export function purgeOldSnapshots(days: number): number {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM traffic_snapshots WHERE timestamp < datetime('now', ?)"
  ).run(`-${days} days`);
  return result.changes;
}

// ── Route Polyline Queries ──

export interface RoutePolylineRow {
  route_id: string;
  direction: string;
  encoded_polyline: string;
  speed_intervals_json: string;
  total_duration_sec: number;
  total_distance_m: number;
  updated_at: string;
}

export function upsertRoutePolyline(
  routeId: RouteId,
  direction: Direction,
  encodedPolyline: string,
  speedIntervals: SpeedInterval[],
  totalDurationSec: number,
  totalDistanceM: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO route_polylines
      (route_id, direction, encoded_polyline, speed_intervals_json,
       total_duration_sec, total_distance_m, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    routeId,
    direction,
    encodedPolyline,
    JSON.stringify(speedIntervals),
    totalDurationSec,
    totalDistanceM
  );
}

export function getRoutePolylines(): RoutePolyline[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM route_polylines").all() as RoutePolylineRow[];
  return rows.map((row) => ({
    routeId: row.route_id as RouteId,
    direction: row.direction as Direction,
    encodedPolyline: row.encoded_polyline,
    speedIntervals: JSON.parse(row.speed_intervals_json) as SpeedInterval[],
    totalDurationSec: row.total_duration_sec,
    totalDistanceM: row.total_distance_m,
    updatedAt: row.updated_at,
  }));
}

// ── Converters ──

export function snapshotToTrafficState(row: SnapshotRow) {
  return {
    segmentId: row.segment_id,
    direction: row.direction as Direction,
    timestamp: row.timestamp,
    currentSpeedKmh: row.current_speed_kmh,
    freeFlowSpeedKmh: row.free_flow_speed_kmh,
    estimatedMinutes: Math.round(row.estimated_minutes),
    congestionLevel: row.congestion_level as CongestionLevel,
    congestionRatio: row.congestion_ratio,
    reportCount: 0,
  };
}

export function averageToTrafficState(
  row: HourlyAverageRow,
  routeId: RouteId,
  baseMinutes: number
) {
  return {
    segmentId: row.segment_id,
    direction: row.direction as Direction,
    timestamp: new Date().toISOString(),
    currentSpeedKmh: row.avg_speed_kmh,
    freeFlowSpeedKmh: row.avg_speed_kmh * row.avg_congestion_ratio,
    estimatedMinutes: Math.round(row.avg_minutes || baseMinutes * row.avg_congestion_ratio),
    congestionLevel: getCongestionLevel(row.avg_congestion_ratio),
    congestionRatio: row.avg_congestion_ratio,
    reportCount: 0,
  };
}

export function averageToHourlyPattern(row: HourlyAverageRow) {
  const routeId = row.segment_id.split("-").slice(0, -1).join("-") as RouteId;
  return {
    hour: row.hour,
    dayType: row.day_type as "weekday" | "saturday" | "sunday",
    routeId,
    direction: row.direction as Direction,
    avgCongestionRatio: row.avg_congestion_ratio,
    avgTotalMinutes: Math.round(row.avg_minutes),
  };
}

// ── Incident Queries ──

export function upsertIncidents(incidents: import("./types").Incident[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO incidents
      (id, source, source_id, route_id, segment_id, type, severity,
       title, description, lat, lng, km_marker, reported_at, updated_at, active)
    VALUES
      (@id, @source, @source_id, @route_id, @segment_id, @type, @severity,
       @title, @description, @lat, @lng, @km_marker, @reported_at, @updated_at, 1)
    ON CONFLICT(id) DO UPDATE SET
      severity = excluded.severity,
      title = excluded.title,
      description = excluded.description,
      updated_at = excluded.updated_at,
      active = 1
  `);

  const run = db.transaction((items: import("./types").Incident[]) => {
    for (const inc of items) {
      stmt.run({
        id: inc.id,
        source: inc.source,
        source_id: inc.id,
        route_id: inc.routeId,
        segment_id: inc.segmentId,
        type: inc.type,
        severity: inc.severity,
        title: inc.title,
        description: inc.description,
        lat: inc.coords[0],
        lng: inc.coords[1],
        km_marker: inc.kmMarker,
        reported_at: inc.reportedAt,
        updated_at: inc.updatedAt,
      });
    }
  });

  run(incidents);
}

export function resolveStaleIncidents(source: string, activeIds: string[]): number {
  const db = getDb();
  if (activeIds.length === 0) {
    const result = db.prepare(
      "UPDATE incidents SET active = 0, resolved_at = datetime('now') WHERE source = ? AND active = 1"
    ).run(source);
    return result.changes;
  }

  const placeholders = activeIds.map(() => "?").join(",");
  const result = db.prepare(
    `UPDATE incidents SET active = 0, resolved_at = datetime('now')
     WHERE source = ? AND active = 1 AND id NOT IN (${placeholders})`
  ).run(source, ...activeIds);
  return result.changes;
}

export function getActiveIncidents(routeId?: string): IncidentRow[] {
  const db = getDb();
  if (routeId) {
    return db.prepare(
      "SELECT * FROM incidents WHERE active = 1 AND route_id = ? ORDER BY severity, reported_at DESC"
    ).all(routeId) as IncidentRow[];
  }
  return db.prepare(
    "SELECT * FROM incidents WHERE active = 1 ORDER BY severity, reported_at DESC"
  ).all() as IncidentRow[];
}

export function incidentRowToIncident(row: IncidentRow): import("./types").Incident {
  return {
    id: row.id,
    source: row.source,
    routeId: (row.route_id as RouteId) || null,
    segmentId: row.segment_id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description || "",
    coords: [row.lat, row.lng],
    kmMarker: row.km_marker,
    reportedAt: row.reported_at,
    updatedAt: row.updated_at,
    active: row.active === 1,
  };
}
