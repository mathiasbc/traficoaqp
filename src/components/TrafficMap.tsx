"use client";

import dynamic from "next/dynamic";
import type { TrafficState, Incident, RoutePolyline, Direction } from "@/lib/types";

const TrafficMapInner = dynamic(() => import("./TrafficMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface Props {
  states: TrafficState[];
  incidents: Incident[];
  polylines: RoutePolyline[];
  direction: Direction;
}

export default function TrafficMap({ states, incidents, polylines, direction }: Props) {
  return <TrafficMapInner states={states} incidents={incidents} polylines={polylines} direction={direction} />;
}
