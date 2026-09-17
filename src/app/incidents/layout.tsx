import type { Metadata } from "next";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsLayout({
  children,
}: LayoutProps<"/incidents">) {
  return children;
}
