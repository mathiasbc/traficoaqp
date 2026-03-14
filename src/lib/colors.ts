import type { CongestionLevel, RouteId } from "./types";

// ── Sillar Oscuro Theme ──
// Dark volcanic theme inspired by Arequipa's white sillar stone against night sky

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  libre: "#00E396",
  moderado: "#FEB019",
  alto: "#FF6B35",
  muy_alto: "#E94560",
  colapsado: "#FF0844",
};

export const CONGESTION_BG: Record<CongestionLevel, string> = {
  libre: "#0A2E1F",
  moderado: "#2E2408",
  alto: "#2E1608",
  muy_alto: "#2E0A12",
  colapsado: "#2E0008",
};

export const CONGESTION_TEXT: Record<CongestionLevel, string> = {
  libre: "#00E396",
  moderado: "#FEB019",
  alto: "#FF6B35",
  muy_alto: "#E94560",
  colapsado: "#FF0844",
};

export const ROUTE_COLORS: Record<RouteId, string> = {
  uchumayo: "#E94560",
  "cerro-verde": "#00E396",
};

export const CLOSED_COLORS = {
  background: "#1E1E36",
  text: "#6B6B8D",
  border: "#2A2A4A",
  badge: "#6B6B8D",
  badgeBg: "#2A2A4A",
  polyline: "#3A3A5C",
};

export const UI_COLORS = {
  background: "#1A1A2E",
  surface: "#16213E",
  card: "#0F3460",
  text: "#E8E8E8",
  textLight: "#8B8BA3",
  border: "#2A2A4A",
  accent: "#E94560",
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
