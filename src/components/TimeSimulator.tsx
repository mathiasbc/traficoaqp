"use client";

interface Props {
  simulatedHour: number | null;
  onHourChange: (hour: number | null) => void;
  isLive: boolean;
}

export default function TimeSimulator({
  simulatedHour,
  onHourChange,
  isLive,
}: Props) {
  const currentHour = new Date().getHours();
  const displayHour = simulatedHour ?? currentHour;

  return (
    <div
      className="rounded-xl p-4 shadow-lg border"
      style={{ backgroundColor: "#16213E", borderColor: "#2A2A4A" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm" style={{ color: "#E8E8E8" }}>
            Simulador de hora
          </h3>
          <p className="text-xs" style={{ color: "#8B8BA3" }}>
            {isLive ? (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: "#00E396" }}
                />
                En vivo
              </span>
            ) : (
              `Simulando: ${String(displayHour).padStart(2, "0")}:00`
            )}
          </p>
        </div>
        {!isLive && (
          <button
            onClick={() => onHourChange(null)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: "#0A2E1F",
              color: "#00E396",
              border: "1px solid #00E39644",
            }}
          >
            Ahora
          </button>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={23}
          value={displayHour}
          onChange={(e) => onHourChange(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{ backgroundColor: "#2A2A4A" }}
        />
        <div className="flex justify-between text-[10px]" style={{ color: "#6B6B8D" }}>
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h}>{h}h</span>
          ))}
        </div>
      </div>

      <div className="mt-3 text-center">
        <span
          className="text-3xl font-bold tabular-nums"
          style={{ color: "#E8E8E8" }}
        >
          {String(displayHour).padStart(2, "0")}:00
        </span>
      </div>
    </div>
  );
}
