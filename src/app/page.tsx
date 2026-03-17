"use client";

import { useState } from "react";
import { useTrafficData, type RouteTrafficData } from "@/hooks/useTrafficData";
import { formatPeruTime, getTimeAgo, getPeruHour } from "@/lib/traffic";
import { ROUTE_CONFIG } from "@/lib/roads";
import { ROUTE_COLORS } from "@/lib/colors";
import type { RouteId, Direction } from "@/lib/types";
import TrafficMap from "@/components/TrafficMap";
import IncidentBanner from "@/components/IncidentBanner";
import RouteSummaryCard from "@/components/RoadSummary";
import HourlyChart from "@/components/HourlyChart";


function RouteSection({
  routeId,
  routeData,
  currentHour,
}: {
  routeId: RouteId;
  routeData: RouteTrafficData;
  currentHour: number;
}) {
  const config = ROUTE_CONFIG[routeId];
  const color = ROUTE_COLORS[routeId];

  return (
    <section className="mt-5 mx-3 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-slate-800/80 shadow-2xl shadow-black/40">
      <div
        className="mb-4 px-3.5 py-3 sm:px-5 sm:py-3.5"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <h2 className="font-bold text-base sm:text-lg tracking-tight" style={{ color }}>
          {config.name}
        </h2>
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 mb-4">
        <RouteSummaryCard data={routeData.salida} />
        <RouteSummaryCard data={routeData.ingreso} />
      </div>

      <HourlyChart
        patterns={routeData.hourlyPatterns}
        routeColor={color}
        routeName={config.shortName}
        currentHour={currentHour}
      />
    </section>
  );
}

export default function Home() {
  const { states, incidents, polylines, routeData, lastUpdated } = useTrafficData();

  const [direction, setDirection] = useState<Direction>("salida");
  const now = new Date();
  const currentHour = getPeruHour(now);

  return (
    <main className="min-h-screen max-w-2xl mx-auto pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md px-3.5 sm:px-5 py-3 border-b border-slate-800/50"
        style={{ backgroundColor: "rgba(2, 6, 23, 0.85)" }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-xl font-bold tracking-tight">
            <span className="text-slate-400">Corredor</span>{" "}
            <span className="text-slate-100">AQP · KM 48</span>
          </h1>
          <div className="text-right">
            <p className="text-sm sm:text-lg font-bold tabular-nums text-slate-50" suppressHydrationWarning>
              {formatPeruTime(now)}
            </p>
            <p className="text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5 justify-end">
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500" />
                Actualizado {getTimeAgo(lastUpdated.toISOString())}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="px-3 sm:px-4 space-y-3 mt-3">
        <IncidentBanner incidents={incidents} />

        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">Estado de la Vía</h2>
          <div className="flex rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900/50">
            {(["salida", "ingreso"] as Direction[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-5 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 ${
                  d === direction
                    ? "bg-slate-600 text-slate-50"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                {d === "salida" ? "Salida" : "Ingreso"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[45vh] min-h-[280px] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl shadow-black/20 border border-slate-800/50">
          <TrafficMap states={states} incidents={incidents} polylines={polylines} direction={direction} />
        </div>
      </div>

      <RouteSection
        routeId="uchumayo"
        routeData={routeData.uchumayo}
        currentHour={currentHour}
      />

      <RouteSection
        routeId="cerro-verde"
        routeData={routeData["cerro-verde"]}
        currentHour={currentHour}
      />

      <footer className="mt-8 px-3 pb-6 text-center">
        <p className="text-[10px] sm:text-xs text-slate-500">
          mathiasbc@gmail.com · Arequipa, Perú
        </p>
      </footer>
    </main>
  );
}
