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
          className="px-5 py-4 rounded-2xl shadow-xl shadow-rose-900/20 animate-glow-red bg-rose-950/80 border border-rose-500/30 text-rose-50"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">
              {INCIDENT_ICONS[incident.type] || "⚠️"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-rose-100">{incident.title}</p>
              <p className="text-xs mt-1 text-rose-200/80 leading-relaxed">
                {incident.description}
              </p>
              <p className="text-xs mt-2 font-medium text-rose-300/70">
                Fuente: {incident.source.toUpperCase()} · {getTimeAgo(incident.reportedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
