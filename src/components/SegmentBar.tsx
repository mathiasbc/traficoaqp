"use client";

import type { TrafficState } from "@/lib/types";
import { CONGESTION_COLORS, CONGESTION_LABELS } from "@/lib/colors";

interface Props {
  segments: TrafficState[];
}

export default function SegmentBar({ segments }: Props) {
  if (segments.length === 0) return null;

  return (
    <div className="flex w-full gap-1 rounded-full overflow-hidden h-6 bg-slate-950/50 p-0.5 border border-slate-800/50">
      {segments.map((seg) => (
        <div
          key={seg.segmentId}
          className="flex-1 relative group cursor-pointer transition-colors duration-300 hover:opacity-80 rounded-full"
          style={{ backgroundColor: CONGESTION_COLORS[seg.congestionLevel] }}
          title={`${seg.segmentId}: ${CONGESTION_LABELS[seg.congestionLevel]} (${seg.estimatedMinutes} min)`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white/90 drop-shadow-md">
              {seg.estimatedMinutes}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
