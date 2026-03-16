"use client";

import type { Incident } from "@/lib/types";
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
          className="px-4 py-3.5 rounded-xl bg-rose-950/60 border border-rose-500/20 text-rose-50"
          style={{ borderLeft: "3px solid #fb7185" }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-rose-100">{incident.title}</p>
            <p className="text-xs mt-1 text-rose-200/70 leading-relaxed">
              {incident.description}
            </p>
            <p className="text-[11px] mt-2 font-medium text-rose-300/50">
              {incident.source.toUpperCase()} · {getTimeAgo(incident.reportedAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
