"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { HourlyPattern, RouteId } from "@/lib/types";

const SALIDA_COLOR = "#4CC9F0";  // cyan — outbound
const INGRESO_COLOR = "#F4A261"; // amber — inbound

interface Props {
  patterns: HourlyPattern[];  // Pre-filtered for this route
  routeId: RouteId;
  routeColor: string;
  routeName: string;
  currentHour: number;
  isLive: boolean;
}

export default function HourlyChart({ patterns, routeColor, routeName, currentHour }: Props) {
  // Filter weekday patterns (patterns already filtered by route)
  const weekdayPatterns = patterns.filter((p) => p.dayType === "weekday");

  const salidaData = weekdayPatterns.filter((p) => p.direction === "salida");
  const ingresoData = weekdayPatterns.filter((p) => p.direction === "ingreso");

  const chartData = Array.from({ length: 24 }, (_, i) => {
    const sal = salidaData.find((p) => p.hour === i);
    const ing = ingresoData.find((p) => p.hour === i);
    return {
      hour: i,
      label: i % 3 === 0 ? `${i}h` : "",
      salida: sal?.avgCongestionRatio ?? 0,
      ingreso: ing?.avgCongestionRatio ?? 0,
    };
  });

  // Dynamic Y-axis max based on data
  const maxRatio = Math.max(
    ...chartData.map((d) => Math.max(d.salida, d.ingreso)),
    2
  );
  const yMax = Math.ceil(maxRatio + 0.5);

  return (
    <div
      className="rounded-xl p-4 shadow-lg border"
      style={{ backgroundColor: "#16213E", borderColor: "#2A2A4A" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm" style={{ color: routeColor }}>
            Congestión {routeName} (día típico)
          </h3>
          <p className="text-xs" style={{ color: "#8B8BA3" }}>Multiplicador vs flujo libre</p>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "#8B8BA3" }}>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: SALIDA_COLOR }}
            />
            Salida →
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: INGRESO_COLOR }}
            />
            ← Ingreso
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={0} barCategoryGap="15%">
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#8B8BA3" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 10, fill: "#8B8BA3" }}
            axisLine={false}
            tickLine={false}
            width={25}
            tickFormatter={(v: number) => `${v}x`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const hour = payload[0]?.payload?.hour;
              const sal = payload.find((p) => p.dataKey === "salida")?.value as number;
              const ing = payload.find((p) => p.dataKey === "ingreso")?.value as number;
              return (
                <div
                  className="rounded-lg p-2 shadow-md text-xs border"
                  style={{ backgroundColor: "#0F3460", borderColor: "#2A2A4A", color: "#E8E8E8" }}
                >
                  <p className="font-bold mb-1">
                    {String(hour).padStart(2, "0")}:00
                  </p>
                  <p style={{ color: SALIDA_COLOR }}>
                    Salida →: {sal?.toFixed(1)}x
                  </p>
                  <p style={{ color: INGRESO_COLOR }}>
                    ← Ingreso: {ing?.toFixed(1)}x
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            x={currentHour % 3 === 0 ? `${currentHour}h` : ""}
            stroke="#E8E8E8"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Bar dataKey="salida" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`sal-${index}`}
                fill={
                  index === currentHour
                    ? SALIDA_COLOR
                    : `${SALIDA_COLOR}99`
                }
                stroke={index === currentHour ? "#E8E8E8" : "none"}
                strokeWidth={index === currentHour ? 2 : 0}
              />
            ))}
          </Bar>
          <Bar dataKey="ingreso" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`ing-${index}`}
                fill={
                  index === currentHour
                    ? INGRESO_COLOR
                    : `${INGRESO_COLOR}99`
                }
                stroke={index === currentHour ? "#E8E8E8" : "none"}
                strokeWidth={index === currentHour ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
