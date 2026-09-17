import type { Metadata } from "next";
import { Deck } from "@/components/presentation/deck";

export const metadata: Metadata = { title: "SIREN — Pitch Deck" };

export default function PresentationPage() {
  return <Deck />;
}
