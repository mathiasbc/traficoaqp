"use client";

import type { Incident } from "@/lib/types";
import { INCIDENT_ICONS } from "@/lib/roads";
import { getTimeAgo } from "@/lib/traffic";

interface Props {
  incidents: Incident[];
}

export default function IncidentBanner({ incidents }: Props) {
  const criticalIncidents = incidents.filter(
    (i) => i.severity === "critico" && i.active
  );

  if (criticalIncidents.length === 0) return null;

  return (
    <div className="space-y-2">
      {criticalIncidents.map((incident) => (
        <div
          key={incident.id}
          className="text-white px-4 py-3 rounded-lg shadow-lg animate-glow-red"
          style={{
            backgroundColor: "#8B0000",
            border: "1px solid #E9456044",
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">
              {INCIDENT_ICONS[incident.type] || "⚠️"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{incident.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "#FF8A8A" }}>
                {incident.description}
              </p>
              <p className="text-xs mt-1" style={{ color: "#FF6B6B" }}>
                Reportado por {incident.reportedBy} · {getTimeAgo(incident.reportedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
