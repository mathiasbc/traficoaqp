import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TráficoAQP — Corredor Arequipa–Km 48 en tiempo real",
  description:
    "Monitoreo en tiempo real del corredor Arequipa–Km 48: Vía Uchumayo y Vía Cerro Verde. Estado de tráfico por dirección.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} font-sans antialiased`}
        style={{ backgroundColor: "#1A1A2E" }}
      >
        {children}
      </body>
    </html>
  );
}
