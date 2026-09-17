import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const barlowSemi = Barlow_Semi_Condensed({
  variable: "--font-barlow-semi",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SIREN — Autonomous Fire Dispatch",
  description:
    "An AI agent that dispatches and co-ordinates fire station vehicles, crews and equipment.",
};

export const viewport: Viewport = {
  themeColor: "#060607",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlowSemi.variable} ${barlow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
