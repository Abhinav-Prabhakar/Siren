import { ResourcesView } from "@/components/resources/resources-view";
import type { ResourceTab } from "@/components/resources/tab-rail";

const TABS: readonly ResourceTab[] = ["vehicles", "equipment", "people"];

export default async function Page(props: PageProps<"/resources">) {
  const searchParams = await props.searchParams;
  const raw = searchParams.tab;
  const tab = Array.isArray(raw) ? raw[0] : raw;
  const initialTab: ResourceTab = TABS.includes(tab as ResourceTab)
    ? (tab as ResourceTab)
    : "vehicles";
  return <ResourcesView initialTab={initialTab} />;
}
