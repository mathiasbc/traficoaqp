import type { CongestionLevel, RouteId } from "./types";

// ── Sillar Oscuro Theme ──
// Dark volcanic theme inspired by Arequipa's white sillar stone against night sky

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  libre: "#34d399", // emerald-400
  moderado: "#fbbf24", // amber-400
  alto: "#fb923c", // orange-400
  muy_alto: "#fb7185", // rose-400
  colapsado: "#ef4444", // red-500
};

export const CONGESTION_BG: Record<CongestionLevel, string> = {
  libre: "#064e3b22",
  moderado: "#78350f22",
  alto: "#7c2d1222",
  muy_alto: "#88133722",
  colapsado: "#7f1d1d22",
};

export const CONGESTION_TEXT: Record<CongestionLevel, string> = {
  libre: "#34d399",
  moderado: "#fbbf24",
  alto: "#fb923c",
  muy_alto: "#fb7185",
  colapsado: "#f87171",
};

export const ROUTE_COLORS: Record<RouteId, string> = {
  uchumayo: "#3b82f6", // blue-500
  "cerro-verde": "#10b981", // emerald-500
};

export const CONGESTION_LABELS: Record<CongestionLevel, string> = {
  libre: "LIBRE",
  moderado: "MODERADO",
  alto: "ALTO",
  muy_alto: "MUY ALTO",
  colapsado: "COLAPSADO",
};

export function getCongestionLevel(ratio: number): CongestionLevel {
  if (ratio <= 1.2) return "libre";
  if (ratio <= 1.8) return "moderado";
  if (ratio <= 2.5) return "alto";
  if (ratio <= 3.5) return "muy_alto";
  return "colapsado";
}
