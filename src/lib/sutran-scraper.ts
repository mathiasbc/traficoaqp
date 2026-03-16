import type { Incident, IncidentType, IncidentSeverity } from "./types";
import { isInCorridor, matchIncidentToSegment } from "./incident-matcher";

const SUTRAN_URL = "https://gis.sutran.gob.pe/alerta_sutran/script_cgm/carga_xlsx.php";

// SUTRAN returns GeoJSON Features with tipo=MAPA
interface SutranFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
  properties: {
    item?: string;
    estado?: string;
    carretera?: string;
    evento?: string;
    progresiva?: string;
    fuente?: string;
    fecha_evento?: string;
    fecha_actualizacion?: string;
    tipo_alerta_?: string;
    visualizacion_?: string;
  };
}

function parseStatus(estado: string | undefined): { severity: IncidentSeverity; type: IncidentType } | null {
  if (!estado) return null;
  const upper = estado.toUpperCase();
  if (upper.includes("INTERRUMPIDO")) return { severity: "critico", type: "cierre" };
  if (upper.includes("RESTRINGIDO")) return { severity: "medio", type: "obras" };
  // NORMAL status = no incident
  return null;
}

function hashId(feature: SutranFeature): string {
  const props = feature.properties;
  const coords = feature.geometry.coordinates;
  const raw = `${props.item || ""}${coords[0]}${coords[1]}${props.evento || ""}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `sutran-${Math.abs(hash).toString(36)}`;
}

function parseDateString(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();
  // SUTRAN dates: "28/02/2026" (dd/mm/yyyy)
  const parts = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (parts) {
    return new Date(`${parts[3]}-${parts[2]}-${parts[1]}T00:00:00-05:00`).toISOString();
  }
  return new Date().toISOString();
}

function parseFeature(feature: SutranFeature): Incident | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  // GeoJSON uses [lng, lat] — convert to our [lat, lng]
  const lng = coords[0];
  const lat = coords[1];
  if (isNaN(lat) || isNaN(lng)) return null;
  if (!isInCorridor(lat, lng)) return null;

  const props = feature.properties;
  const status = parseStatus(props.estado);
  if (!status) return null;

  const match = matchIncidentToSegment(lat, lng);
  const title = (props.evento || "Incidente en la vía").trim();
  const description = (props.carretera || "").trim();

  return {
    id: hashId(feature),
    source: "sutran",
    routeId: match.routeId,
    segmentId: match.segmentId,
    type: status.type,
    severity: status.severity,
    title,
    description,
    coords: [lat, lng],
    kmMarker: props.progresiva?.trim() || null,
    reportedAt: parseDateString(props.fecha_evento),
    updatedAt: props.fecha_actualizacion ? parseDateString(props.fecha_actualizacion) : null,
    active: true,
  };
}

export async function fetchSutranAlerts(): Promise<Incident[]> {
  try {
    const res = await fetch(SUTRAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "tipo=MAPA",
    });

    if (!res.ok) {
      console.error(`[SUTRAN] HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();
    // Remove BOM if present
    const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const data = JSON.parse(clean);

    // Response is an array of GeoJSON Features or an object wrapping them
    const features: SutranFeature[] = Array.isArray(data)
      ? data
      : Object.values(data).flat().filter((v): v is SutranFeature =>
          typeof v === "object" && v !== null && (v as SutranFeature).type === "Feature"
        );

    const incidents: Incident[] = [];
    for (const feature of features) {
      const incident = parseFeature(feature);
      if (incident) incidents.push(incident);
    }

    console.log(`[SUTRAN] Fetched ${features.length} alerts, ${incidents.length} in corridor`);
    return incidents;
  } catch (err) {
    console.error("[SUTRAN] Fetch failed:", err);
    return [];
  }
}
