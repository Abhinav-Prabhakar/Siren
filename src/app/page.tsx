import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { LlmChat } from "@/components/chat/llm-chat";

export const metadata: Metadata = { title: "SIREN-1" };

export default function Page() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink">
      <ConsoleNav />
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-5 py-5">
        <LlmChat className="min-h-0 flex-1" />
      </main>
    </div>
  );
}
