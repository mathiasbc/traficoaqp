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
import type { HourlyPattern } from "@/lib/types";

const SALIDA_COLOR = "#94a3b8";  // slate-400 — outbound (neutral)
const INGRESO_COLOR = "#fbbf24"; // amber-400 — inbound (warm)

interface Props {
  patterns: HourlyPattern[];
  routeColor: string;
  routeName: string;
  currentHour: number;
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
    <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-black/10 border border-slate-800/50 bg-slate-950/50">
      <div className="flex flex-col min-[400px]:flex-row min-[400px]:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-xs sm:text-sm" style={{ color: routeColor }}>
            Congestión {routeName} (día típico)
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Multiplicador vs flujo libre</p>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: SALIDA_COLOR }}
            />
            Salida
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: INGRESO_COLOR }}
            />
            Ingreso
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={chartData} barGap={0} barCategoryGap="15%">
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(h: number) => {
              if (h % 3 === 0 || h === 23) return `${h}h`;
              return "";
            }}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 10, fill: "#64748b" }}
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
                  className="rounded-xl p-3 shadow-xl text-xs border border-slate-800/80 bg-slate-900/95 backdrop-blur-sm text-slate-50"
                >
                  <p className="font-bold mb-2 text-slate-300">
                    {String(hour).padStart(2, "0")}:00
                  </p>
                  <p className="font-medium" style={{ color: SALIDA_COLOR }}>
                    Salida: {sal?.toFixed(1)}x
                  </p>
                  <p className="font-medium mt-1" style={{ color: INGRESO_COLOR }}>
                    Ingreso: {ing?.toFixed(1)}x
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            x={currentHour}
            stroke="#334155"
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
