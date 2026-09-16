import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const shareTech = Share_Tech_Mono({
  variable: "--font-sharetech",
  subsets: ["latin"],
  weight: "400",
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
      className={`${orbitron.variable} ${chakra.variable} ${shareTech.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
