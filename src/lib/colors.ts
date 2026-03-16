import type { CongestionLevel, RouteId } from "./types";

// ── Sillar Oscuro Theme ──
// Dark volcanic theme inspired by Arequipa's white sillar stone against night sky

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  libre: "#10b981", // emerald-500
  moderado: "#f59e0b", // amber-500
  alto: "#f97316", // orange-500
  muy_alto: "#f43f5e", // rose-500
  colapsado: "#dc2626", // red-600
};

export const CONGESTION_BG: Record<CongestionLevel, string> = {
  libre: "#064e3b", // emerald-900
  moderado: "#78350f", // amber-900
  alto: "#7c2d12", // orange-900
  muy_alto: "#881337", // rose-900
  colapsado: "#7f1d1d", // red-900
};

export const CONGESTION_TEXT: Record<CongestionLevel, string> = {
  libre: "#34d399", // emerald-400
  moderado: "#fbbf24", // amber-400
  alto: "#fb923c", // orange-400
  muy_alto: "#fb7185", // rose-400
  colapsado: "#f87171", // red-400
};

export const ROUTE_COLORS: Record<RouteId, string> = {
  uchumayo: "#3b82f6", // blue-500
  "cerro-verde": "#10b981", // emerald-500
};

export const CLOSED_COLORS = {
  background: "#0f172a", // slate-900
  text: "#64748b", // slate-500
  border: "#1e293b", // slate-800
  badge: "#94a3b8", // slate-400
  badgeBg: "#1e293b", // slate-800
  polyline: "#334155", // slate-700
};

export const UI_COLORS = {
  background: "#020617", // slate-950
  surface: "#0f172a", // slate-900
  card: "#0f172a", // slate-900
  text: "#f8fafc", // slate-50
  textLight: "#94a3b8", // slate-400
  border: "#1e293b", // slate-800
  accent: "#3b82f6", // blue-500
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
