"use client";

import dynamic from "next/dynamic";
import type { TrafficState, Incident } from "@/lib/types";

const TrafficMapInner = dynamic(() => import("./TrafficMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-xl bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm text-gray-500">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface Props {
  states: TrafficState[];
  incidents: Incident[];
}

export default function TrafficMap({ states, incidents }: Props) {
  return <TrafficMapInner states={states} incidents={incidents} />;
}
