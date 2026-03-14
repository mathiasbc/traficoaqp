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
    <div
      className="rounded-xl p-4 shadow-lg border"
      style={{
        backgroundColor: "#16213E",
        borderColor: "#2A2A4A",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-base"
            style={{ color: "#E8E8E8" }}
          >
            {data.direction === "salida" ? "Arequipa → Km 48" : "Km 48 → Arequipa"}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "#8B8BA3" }}>
            {data.direction === "salida" ? "Salida" : "Ingreso"}
          </p>
        </div>
        <CongestionBadge level={data.overallCongestionLevel} size="sm" />
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#8B8BA3" }}>
            Tiempo estimado
          </p>
          <p className="text-2xl font-bold" style={{ color: "#E8E8E8" }}>
            {formatMinutes(data.totalEstimatedMinutes)}
          </p>
        </div>
        {data.activeIncidentCount > 0 && (
          <div
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ backgroundColor: "#2E0A12", color: "#E94560" }}
          >
            <span>⚠️</span>
            <span>
              {data.activeIncidentCount} incidente
              {data.activeIncidentCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs mb-1" style={{ color: "#8B8BA3" }}>Segmentos (min)</p>
        <SegmentBar segments={data.segments} />
        <div className="flex justify-between mt-1 text-[10px]" style={{ color: "#6B6B8D" }}>
          <span>{data.direction === "salida" ? "Arequipa" : "Km 48"}</span>
          <span>{data.direction === "salida" ? "Km 48" : "Arequipa"}</span>
        </div>
      </div>
    </div>
  );
}
