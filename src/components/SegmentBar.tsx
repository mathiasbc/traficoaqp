"use client";

import type { TrafficState } from "@/lib/types";
import { CONGESTION_COLORS, CONGESTION_LABELS } from "@/lib/colors";

interface Props {
  segments: TrafficState[];
}

export default function SegmentBar({ segments }: Props) {
  if (segments.length === 0) return null;

  return (
    <div className="flex w-full gap-0.5 rounded-md overflow-hidden h-5">
      {segments.map((seg) => (
        <div
          key={seg.segmentId}
          className="flex-1 relative group cursor-pointer transition-all hover:opacity-80"
          style={{ backgroundColor: CONGESTION_COLORS[seg.congestionLevel] }}
          title={`${seg.segmentId}: ${CONGESTION_LABELS[seg.congestionLevel]} (${seg.estimatedMinutes} min)`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white drop-shadow-sm">
              {seg.estimatedMinutes}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
