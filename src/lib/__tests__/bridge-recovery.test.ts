import { describe, it, expect } from "vitest";
import {
  findUncoveredSegments,
  getClosedRouteIds,
  STATIC_PATHS,
} from "../map-utils";
import { UCHUMAYO_PATH } from "../uchumayo-path";
import { matchIncidentToSegment, isInCorridor } from "../incident-matcher";
import type { Incident } from "../types";

// ── Helpers ──

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "test-1",
    source: "sutran",
    routeId: "uchumayo",
    segmentId: "uchumayo-2",
    type: "cierre",
    severity: "critico",
    title: "Puente Uchumayo colapsado",
    description: "Afectación de loza de concreto",
    coords: [-16.4220, -71.6480],
    kmMarker: null,
    reportedAt: new Date().toISOString(),
    updatedAt: null,
    active: true,
    ...overrides,
  };
}

// A polyline that closely follows the UCHUMAYO_PATH (bridge open scenario).
// Google returns high-density polylines that hug the road, so we add a
// tiny offset (~50m) to simulate a slightly different but aligned trace.
const ORIGINAL_ROUTE_POLYLINE: [number, number][] = UCHUMAYO_PATH.map(
  ([lat, lng]) => [lat + 0.0003, lng + 0.0003] as [number, number]
);

// A polyline that follows the first ~45 points (Sachaca to Uchumayo town),
// then veers south to simulate the Cerro Verde detour, and rejoins near Km 48.
const DETOUR_POLYLINE: [number, number][] = [
  ...UCHUMAYO_PATH.slice(0, 46),
  // Detour through Cerro Verde area (south of the old road)
  [-16.420, -71.625],
  [-16.440, -71.635],
  [-16.460, -71.650],
  [-16.490, -71.680],
  [-16.510, -71.720],
  [-16.520, -71.740],
  [-16.525, -71.760],
  // Rejoin near Km 48
  ...UCHUMAYO_PATH.slice(-5),
];

// ── findUncoveredSegments ──

describe("findUncoveredSegments", () => {
  it("returns empty when Google polyline follows the static path (bridge open)", () => {
    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      ORIGINAL_ROUTE_POLYLINE
    );

    expect(uncovered).toHaveLength(0);
  });

  it("finds uncovered segments when Google detours around the bridge", () => {
    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      DETOUR_POLYLINE
    );

    expect(uncovered.length).toBeGreaterThan(0);

    const totalUncoveredPoints = uncovered.reduce(
      (sum, seg) => sum + seg.length,
      0
    );
    expect(totalUncoveredPoints).toBeGreaterThan(10);
  });

  it("uncovered segments are between Uchumayo town and Km 48 (the bypassed section)", () => {
    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      DETOUR_POLYLINE
    );

    for (const segment of uncovered) {
      for (const [lat, lng] of segment) {
        // All uncovered points should be south of Sachaca (lat < -16.41)
        // and west of Arequipa center (lng < -71.60) — in the bridge area
        expect(lat).toBeLessThan(-16.40);
        expect(lng).toBeLessThan(-71.60);
      }
    }
  });

  it("uncovered segments include boundary points for visual continuity", () => {
    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      DETOUR_POLYLINE
    );

    if (uncovered.length > 0) {
      const firstSegment = uncovered[0];
      // First point of the uncovered segment should be a "covered" boundary
      // (the last covered point before divergence)
      expect(firstSegment.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns empty for completely identical paths", () => {
    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      [...UCHUMAYO_PATH]
    );

    expect(uncovered).toHaveLength(0);
  });

  it("handles custom threshold", () => {
    // Very tight threshold — more points will be "uncovered"
    const tight = findUncoveredSegments(
      UCHUMAYO_PATH,
      ORIGINAL_ROUTE_POLYLINE,
      0.0001 * 0.0001 // ~11m — too tight, every 3rd point sampling won't match
    );

    // Very loose threshold — fewer points uncovered
    const loose = findUncoveredSegments(
      UCHUMAYO_PATH,
      DETOUR_POLYLINE,
      0.1 * 0.1 // ~11km — everything covered
    );

    expect(tight.length).toBeGreaterThan(0);
    expect(loose).toHaveLength(0);
  });
});

// ── getClosedRouteIds ──

describe("getClosedRouteIds", () => {
  it("returns empty set when no incidents", () => {
    const result = getClosedRouteIds([]);
    expect(result.size).toBe(0);
  });

  it("returns empty set when no active critico incidents", () => {
    const incidents = [
      makeIncident({ severity: "alto", active: true }),
      makeIncident({ severity: "critico", active: false, id: "test-2" }),
    ];
    const result = getClosedRouteIds(incidents);
    expect(result.size).toBe(0);
  });

  it("returns route ID for active critico incident", () => {
    const incidents = [makeIncident()];
    const result = getClosedRouteIds(incidents);
    expect(result.has("uchumayo")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("ignores incidents without routeId", () => {
    const incidents = [makeIncident({ routeId: null })];
    const result = getClosedRouteIds(incidents);
    expect(result.size).toBe(0);
  });

  it("SUTRAN clears incident (active=false) → route no longer closed", () => {
    const before = [makeIncident({ active: true })];
    const after = [makeIncident({ active: false })];

    expect(getClosedRouteIds(before).has("uchumayo")).toBe(true);
    expect(getClosedRouteIds(after).has("uchumayo")).toBe(false);
  });

  it("SUTRAN removes incident entirely → route no longer closed", () => {
    const before = [makeIncident()];
    const after: Incident[] = [];

    expect(getClosedRouteIds(before).has("uchumayo")).toBe(true);
    expect(getClosedRouteIds(after).size).toBe(0);
  });
});

// ── Transition scenarios ──

describe("bridge recovery transition scenarios", () => {
  it("Scenario 1: SUTRAN clears first, Google still detours → no gray overlay", () => {
    // SUTRAN removed the incident, but Google still routes via detour
    const incidents: Incident[] = []; // cleared
    const closedRoutes = getClosedRouteIds(incidents);

    // No closed routes → closedRoadSegments computation is skipped entirely
    expect(closedRoutes.size).toBe(0);

    // Even though Google still detours, there's no dashed gray because
    // the trigger (critico incident) is gone. This is correct: if SUTRAN
    // says the road is clear, we trust it.
  });

  it("Scenario 2: Google restores route first, SUTRAN still shows incident → no gray because paths align", () => {
    // SUTRAN still has the incident, but Google now routes through the bridge
    const incidents = [makeIncident({ active: true })];
    const closedRoutes = getClosedRouteIds(incidents);
    expect(closedRoutes.has("uchumayo")).toBe(true);

    // Google now returns a polyline that follows the original Uchumayo road
    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      ORIGINAL_ROUTE_POLYLINE
    );

    // No uncovered segments because the Google polyline aligns with static path
    expect(uncovered).toHaveLength(0);

    // Result: incident marker still shows, but no dashed gray line.
    // This is correct: the road is physically open (Google routes through it),
    // the incident marker will disappear once SUTRAN updates.
  });

  it("Scenario 3: Both resolved → completely normal rendering", () => {
    const incidents: Incident[] = [];
    const closedRoutes = getClosedRouteIds(incidents);
    expect(closedRoutes.size).toBe(0);

    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      ORIGINAL_ROUTE_POLYLINE
    );
    expect(uncovered).toHaveLength(0);

    // No incidents, no closed routes, no uncovered segments.
    // Map renders speed-colored polylines normally.
  });

  it("Scenario 4: Current state (bridge closed) → gray overlay on old road", () => {
    const incidents = [makeIncident({ active: true })];
    const closedRoutes = getClosedRouteIds(incidents);
    expect(closedRoutes.has("uchumayo")).toBe(true);

    const uncovered = findUncoveredSegments(
      UCHUMAYO_PATH,
      DETOUR_POLYLINE
    );

    // Should find the bypassed section of the old road
    expect(uncovered.length).toBeGreaterThan(0);

    // The dashed gray should cover the road from ~Uchumayo town to Km 48
    const allUncoveredPoints = uncovered.flat();
    const lats = allUncoveredPoints.map((p) => p[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Uchumayo town is around -16.414, Km 48 is around -16.529
    expect(maxLat).toBeGreaterThan(-16.43);
    expect(minLat).toBeLessThan(-16.52);
  });
});

// ── incident-matcher (for SUTRAN data) ──

describe("incident-matcher", () => {
  it("matches Puente Uchumayo coordinates to uchumayo route", () => {
    const bridgeLat = -16.4220;
    const bridgeLng = -71.6480;

    expect(isInCorridor(bridgeLat, bridgeLng)).toBe(true);

    const result = matchIncidentToSegment(bridgeLat, bridgeLng);
    expect(result.routeId).toBe("uchumayo");
    expect(result.segmentId).toMatch(/^uchumayo-/);
  });

  it("does not match coordinates outside the corridor", () => {
    // Lima
    const result = matchIncidentToSegment(-12.046, -77.043);
    expect(result.routeId).toBeNull();
  });

  it("matches Cerro Verde area to cerro-verde route", () => {
    const result = matchIncidentToSegment(-16.512, -71.631);
    expect(result.routeId).toBe("cerro-verde");
  });
});

// ── Static path integrity ──

describe("static path integrity", () => {
  it("UCHUMAYO_PATH starts at Sachaca and ends at Km 48", () => {
    const path = STATIC_PATHS["uchumayo"];
    expect(path[0]).toEqual([-16.411156, -71.556356]);
    expect(path[path.length - 1]).toEqual([-16.528782, -71.780655]);
  });

  it("CERRO_VERDE_PATH starts at Sachaca and ends at Km 48", () => {
    const path = STATIC_PATHS["cerro-verde"];
    expect(path[0][0]).toBeCloseTo(-16.411, 2);
    expect(path[path.length - 1][0]).toBeCloseTo(-16.529, 2);
  });

  it("paths have sufficient density for proximity matching", () => {
    expect(STATIC_PATHS["uchumayo"].length).toBeGreaterThan(100);
    expect(STATIC_PATHS["cerro-verde"].length).toBeGreaterThan(100);
  });
});
