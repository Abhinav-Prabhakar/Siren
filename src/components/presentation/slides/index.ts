import { CoverSlide } from "./cover";
import { SolutionSlide } from "./solution";
import { ArchitectureSlide } from "./architecture";
import { FeasibilitySlide } from "./feasibility";
import { ImpactSlide } from "./impact";
import { ClosingSlide } from "./closing";

export const SLIDES = [
  { id: "cover",        label: "Cover // problem",     Component: CoverSlide },
  { id: "solution",     label: "Proposed solution",    Component: SolutionSlide },
  { id: "architecture", label: "Architecture",         Component: ArchitectureSlide },
  { id: "feasibility",  label: "Feasibility",          Component: FeasibilitySlide },
  { id: "impact",       label: "Impact // commercial", Component: ImpactSlide },
  { id: "closing",      label: "Close",                Component: ClosingSlide },
] as const;
