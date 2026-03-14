"use client";

import type { CongestionLevel } from "@/lib/types";
import { CONGESTION_COLORS, CONGESTION_BG, CONGESTION_TEXT, CONGESTION_LABELS } from "@/lib/colors";

interface Props {
  level: CongestionLevel;
  size?: "sm" | "md" | "lg";
}

export default function CongestionBadge({ level, size = "md" }: Props) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5 font-bold",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide ${sizeClasses[size]}`}
      style={{
        backgroundColor: CONGESTION_BG[level],
        color: CONGESTION_TEXT[level],
        borderWidth: 1,
        borderColor: `${CONGESTION_COLORS[level]}66`,
      }}
    >
      <span
        className="mr-1.5 inline-block h-2 w-2 rounded-full"
        style={{
          backgroundColor: CONGESTION_COLORS[level],
          boxShadow: `0 0 6px ${CONGESTION_COLORS[level]}88`,
        }}
      />
      {CONGESTION_LABELS[level]}
    </span>
  );
}
