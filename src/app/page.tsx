"use client";

import { useTrafficData, type RouteTrafficData } from "@/hooks/useTrafficData";
import { formatPeruTime, getTimeAgo } from "@/lib/traffic";
import { ROUTE_CONFIG } from "@/lib/roads";
import { ROUTE_COLORS } from "@/lib/colors";
import type { RouteId } from "@/lib/types";
import TrafficMap from "@/components/TrafficMap";
import IncidentBanner from "@/components/IncidentBanner";
import RouteSummaryCard from "@/components/RoadSummary";
import HourlyChart from "@/components/HourlyChart";
import TimeSimulator from "@/components/TimeSimulator";

// ── Route Section Component ──
function RouteSection({
  routeId,
  routeData,
  currentHour,
  isLive,
}: {
  routeId: RouteId;
  routeData: RouteTrafficData;
  currentHour: number;
  isLive: boolean;
}) {
  const config = ROUTE_CONFIG[routeId];
  const color = ROUTE_COLORS[routeId];

  return (
    <section className="mt-6">
      {/* ── Route Header Bar ── */}
      <div
        className="mx-4 rounded-xl overflow-hidden mb-4 shadow-lg"
        style={{ border: `1px solid ${color}33` }}
      >
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{
            background: `linear-gradient(90deg, ${color}22 0%, transparent 100%)`,
            borderLeft: `4px solid ${color}`,
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{
              backgroundColor: `${color}22`,
              border: `2px solid ${color}55`,
            }}
          >
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg tracking-tight" style={{ color }}>
              {config.name}
            </h2>
          </div>
        </div>
      </div>

      {/* ── Direction Cards: side by side on wider screens ── */}
      <div className="px-4 grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 mb-4">
        <RouteSummaryCard data={routeData.salida} />
        <RouteSummaryCard data={routeData.ingreso} />
      </div>

      {/* ── Hourly Chart for this route ── */}
      <div className="px-4">
        <HourlyChart
          patterns={routeData.hourlyPatterns}
          routeId={routeId}
          routeColor={color}
          routeName={config.shortName}
          currentHour={currentHour}
          isLive={isLive}
        />
      </div>
    </section>
  );
}

// ── Main Page ──
export default function Home() {
  const {
    states,
    incidents,
    routeData,
    simulatedHour,
    setSimulatedHour,
    lastUpdated,
    isLive,
  } = useTrafficData();

  const now = new Date();
  const currentHour = simulatedHour ?? now.getHours();

  return (
    <main className="min-h-screen max-w-2xl mx-auto pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md px-4 py-3 border-b"
        style={{ backgroundColor: "rgba(26,26,46,0.92)", borderColor: "#2A2A4A" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#E8E8E8" }}>
              🚦 TráficoAQP
            </h1>
            <p className="text-xs" style={{ color: "#8B8BA3" }}>
              Corredor Arequipa — Km 48
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-lg font-bold tabular-nums"
              style={{ color: "#E8E8E8" }}
            >
              {formatPeruTime(now)}
            </p>
            <p className="text-[10px]" style={{ color: "#8B8BA3" }}>
              {isLive ? (
                <span className="flex items-center gap-1 justify-end">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: "#00E396" }}
                  />
                  Actualizado {getTimeAgo(lastUpdated.toISOString())}
                </span>
              ) : (
                `Simulando ${String(currentHour).padStart(2, "0")}:00`
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4 mt-4">
        {/* Incident Banner */}
        <IncidentBanner incidents={incidents} />

        {/* Traffic Map */}
        <div
          className="h-[50vh] min-h-[320px] rounded-xl overflow-hidden shadow-lg border"
          style={{ borderColor: "#2A2A4A" }}
        >
          <TrafficMap states={states} incidents={incidents} />
        </div>

        {/* ══ Shared Time Simulator ══ */}
        <TimeSimulator
          simulatedHour={simulatedHour}
          onHourChange={setSimulatedHour}
          isLive={isLive}
        />
      </div>

      {/* ══════════ VÍA UCHUMAYO ══════════ */}
      <RouteSection
        routeId="uchumayo"
        routeData={routeData.uchumayo}
        currentHour={currentHour}
        isLive={isLive}
      />

      {/* ══════════ VÍA CERRO VERDE ══════════ */}
      <RouteSection
        routeId="cerro-verde"
        routeData={routeData["cerro-verde"]}
        currentHour={currentHour}
        isLive={isLive}
      />

      {/* Footer */}
      <footer className="mt-8 px-4 text-center">
        <p className="text-xs" style={{ color: "#8B8BA3" }}>
          Proyecto comunitario · mathiasbc@gmail.com · Arequipa, Perú
        </p>
      </footer>
    </main>
  );
}
