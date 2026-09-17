import { redirect } from "next/navigation";

/** Personnel view consolidated into /resources — keep old links working. */
export default function Page() {
  redirect("/resources?tab=people");
}
