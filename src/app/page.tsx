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

import { Map } from "lucide-react";

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
    <section className="mt-5 mx-3 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-slate-800/80 shadow-2xl shadow-black/40">
      <div
        className="rounded-xl sm:rounded-2xl overflow-hidden mb-4 shadow-xl shadow-black/20"
        style={{ border: `1px solid ${color}33`, backgroundColor: '#0f172a' }}
      >
        <div
          className="px-3.5 py-3 sm:px-5 sm:py-4 flex items-center gap-3"
          style={{
            background: `linear-gradient(90deg, ${color}22 0%, transparent 100%)`,
            borderLeft: `4px solid ${color}`,
          }}
        >
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
            style={{
              backgroundColor: `${color}22`,
              border: `2px solid ${color}55`,
            }}
          >
            {config.icon}
          </div>
          <h2 className="font-bold text-base sm:text-lg tracking-tight" style={{ color }}>
            {config.name}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 mb-4">
        <RouteSummaryCard data={routeData.salida} />
        <RouteSummaryCard data={routeData.ingreso} />
      </div>

      <HourlyChart
        patterns={routeData.hourlyPatterns}
        routeId={routeId}
        routeColor={color}
        routeName={config.shortName}
        currentHour={currentHour}
        isLive={isLive}
      />
    </section>
  );
}

export default function Home() {
  const {
    states,
    incidents,
    polylines,
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
        className="sticky top-0 z-50 backdrop-blur-md px-3.5 sm:px-5 py-3 border-b border-slate-800/50"
        style={{ backgroundColor: "rgba(2, 6, 23, 0.85)" }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-xl font-bold text-slate-50">
            Corredor AQP ↔ KM 48
          </h1>
          <div className="text-right">
            <p className="text-sm sm:text-lg font-bold tabular-nums text-slate-50" suppressHydrationWarning>
              {formatPeruTime(now)}
            </p>
            <p className="text-[10px] text-slate-400">
              {isLive ? (
                <span className="flex items-center gap-1.5 justify-end">
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500" />
                  Actualizado {getTimeAgo(lastUpdated.toISOString())}
                </span>
              ) : (
                `Simulando ${String(currentHour).padStart(2, "0")}:00`
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="px-3 sm:px-4 space-y-3 mt-3">
        <IncidentBanner incidents={incidents} />

        <div className="flex items-center gap-2 px-0.5">
          <Map className="w-4 h-4 text-slate-400" />
          <h2 className="text-xs sm:text-sm font-bold text-slate-200">Estado de la Vía</h2>
        </div>
        <div className="h-[45vh] min-h-[280px] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl shadow-black/20 border border-slate-800/50">
          <TrafficMap states={states} incidents={incidents} polylines={polylines} />
        </div>

        <TimeSimulator
          simulatedHour={simulatedHour}
          onHourChange={setSimulatedHour}
          isLive={isLive}
        />
      </div>

      <RouteSection
        routeId="uchumayo"
        routeData={routeData.uchumayo}
        currentHour={currentHour}
        isLive={isLive}
      />

      <RouteSection
        routeId="cerro-verde"
        routeData={routeData["cerro-verde"]}
        currentHour={currentHour}
        isLive={isLive}
      />

      <footer className="mt-8 px-3 pb-6 text-center">
        <p className="text-[10px] sm:text-xs text-slate-500">
          Proyecto comunitario · mathiasbc@gmail.com · Arequipa, Perú
        </p>
      </footer>
    </main>
  );
}
