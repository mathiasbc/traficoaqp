interface Props {
  destination: [number, number];
  label: string;
  shortLabel: string;
}

export default function GoogleMapsButton({ destination, label, shortLabel }: Props) {
  const [lat, lng] = destination;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold
        text-slate-200 border border-slate-600/70
        hover:text-white hover:border-slate-500/80
        transition-all duration-200 active:scale-95 whitespace-nowrap"
      style={{
        background: `repeating-linear-gradient(
          45deg,
          rgba(255,255,255,0.04) 0px,
          rgba(255,255,255,0.04) 2px,
          rgba(30,41,59,0.85) 2px,
          rgba(30,41,59,0.85) 10px
        )`,
      }}
    >
      <GoogleMapsIcon />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

function GoogleMapsIcon() {
  return (
    <svg
      className="w-[18px] h-[18px] sm:w-5 sm:h-5 shrink-0"
      viewBox="0 0 92.3 132.3"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
      <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
      <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3z" />
      <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.6-8.3 4.2-11.4L4.6 68.1c5.5 12.2 15.4 24.1 27.1 40.5l28-33.3c-3.3 3.8-8.2 6.3-13.5 6.3v2.2z" />
      <path fill="#34a853" d="M59.7 57.6C63.1 53.2 65 48 65 43.5c0-2.4-.4-4.7-1.1-6.8L31.7 108.6c5.5 7.4 11.2 15.7 13.8 23.6 1.4-4.5 4.6-10.7 8.9-18.3l23.5-41.2c-6-4.2-13-10-18.2-15.1z" />
      <path fill="#1a73e8" d="M87.2 24.9C82 14.7 72.7 7 61.5 2.8L33 35.3c3.5-4.2 8.7-6.8 14.5-6.8 10.4 0 18.9 8.5 18.9 18.9 0 5-1.9 9.5-5.1 12.9l22 19.2c8.2-12.5 10.3-24.1 10.3-34.4 0-7.5-2.3-14.6-6.4-21.2z" />
    </svg>
  );
}
