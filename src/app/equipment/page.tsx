import { redirect } from "next/navigation";

/** Equipment view consolidated into /resources — keep old links working. */
export default function Page() {
  redirect("/resources?tab=equipment");
}
