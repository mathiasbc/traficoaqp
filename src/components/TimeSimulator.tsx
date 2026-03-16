"use client";

import { Radio, Undo2 } from "lucide-react";

interface Props {
  simulatedHour: number | null;
  onHourChange: (hour: number | null) => void;
  isLive: boolean;
}

const PERIODS = [
  { start: 0, end: 5, label: "Madrugada", icon: "🌙" },
  { start: 6, end: 11, label: "Mañana", icon: "🌅" },
  { start: 12, end: 17, label: "Tarde", icon: "☀️" },
  { start: 18, end: 23, label: "Noche", icon: "🌆" },
] as const;

function getTimePeriod(hour: number) {
  return PERIODS.find((p) => hour >= p.start && hour <= p.end) ?? PERIODS[0];
}

export default function TimeSimulator({
  simulatedHour,
  onHourChange,
  isLive,
}: Props) {
  const currentHour = new Date().getHours();
  const displayHour = simulatedHour ?? currentHour;
  const period = getTimePeriod(displayHour);

  return (
    <div className="rounded-2xl p-4 border border-slate-800/50 bg-slate-900/80 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En vivo
            </span>
          ) : (
            <button
              onClick={() => onHourChange(null)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-all active:scale-95"
            >
              <Undo2 className="w-3 h-3" />
              Volver a En Vivo
            </button>
          )}
          <span className="text-[11px] text-slate-500">
            {period.icon} {period.label}
          </span>
        </div>
        <span className="text-xl font-bold tabular-nums text-white tracking-tight">
          {String(displayHour).padStart(2, "0")}
          <span className="text-slate-500">:</span>
          00
        </span>
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={23}
          value={displayHour}
          onChange={(e) => onHourChange(parseInt(e.target.value))}
          className="time-slider w-full"
        />
        <div className="flex justify-between mt-1 px-0.5">
          {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
            <span
              key={h}
              className={`text-[10px] tabular-nums transition-colors ${
                h === displayHour
                  ? "text-blue-400 font-bold"
                  : "text-slate-600 font-medium"
              }`}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>

      {isLive && (
        <p className="text-[10px] text-slate-600 text-center mt-1.5">
          Desliza para simular otra hora del día
        </p>
      )}
    </div>
  );
}
