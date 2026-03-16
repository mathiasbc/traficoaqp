"use client";

import type { RouteSummaryData } from "@/lib/types";
import { formatMinutes } from "@/lib/traffic";
import { ROUTE_COLORS } from "@/lib/colors";
import CongestionBadge from "./CongestionBadge";
import SegmentBar from "./SegmentBar";

interface Props {
  data: RouteSummaryData;
}

export default function RouteSummaryCard({ data }: Props) {
  return (
    <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-black/10 border border-slate-800/50 bg-slate-950/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm sm:text-base text-slate-200">
            {data.direction === "salida" ? "Arequipa → Km 48" : "Km 48 → Arequipa"}
          </h3>
          <p className="text-[11px] mt-0.5 text-slate-400 font-medium">
            {data.direction === "salida" ? "Salida" : "Ingreso"}
          </p>
        </div>
        <CongestionBadge level={data.overallCongestionLevel} size="sm" />
      </div>

      <div className="flex items-end gap-3 mb-3">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
            Tiempo estimado
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">
            {formatMinutes(data.totalEstimatedMinutes)}
          </p>
        </div>
        {data.activeIncidentCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/15">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span className="font-medium">
              {data.activeIncidentCount} incidente
              {data.activeIncidentCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] mb-1.5 text-slate-400 font-medium">Segmentos (min)</p>
        <SegmentBar segments={data.segments} />
        <div className="flex justify-between mt-1 text-[10px] font-medium text-slate-500 px-0.5">
          <span>{data.direction === "salida" ? "Arequipa" : "Km 48"}</span>
          <span>{data.direction === "salida" ? "Km 48" : "Arequipa"}</span>
        </div>
      </div>
    </div>
  );
}
