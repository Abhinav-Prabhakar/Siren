import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIREN — Autonomous Fire Dispatch",
    short_name: "SIREN",
    description:
      "An AI agent that dispatches and co-ordinates fire station vehicles, crews and equipment.",
    start_url: "/",
    display: "standalone",
    background_color: "#060607",
    theme_color: "#060607",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
