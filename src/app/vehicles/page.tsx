import { redirect } from "next/navigation";

/** Fleet view consolidated into /resources — keep old links working. */
export default function Page() {
  redirect("/resources?tab=vehicles");
}
