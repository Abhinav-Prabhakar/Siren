"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Meter } from "@/components/ui/meter";
import { Badge } from "@/components/ui/badge";

export function ModalDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button led="pulse" onClick={() => setOpen(true)}>
        Trigger approval modal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm dispatch // INC-4471"
        led="flame"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" led="on">
              Hold
            </Button>
            <Button size="sm" led="pulse" onClick={() => setOpen(false)}>
              Approve dispatch
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-bone/75">
            Agent recommends committing{" "}
            <span className="font-mono text-flame">ENG-01, LDR-02, TND-04</span>{" "}
            to the structure fire at GRID C4. Water tender staged for supply;
            battalion chief notified.
          </p>
          <div className="flex gap-2">
            <Badge tone="hot">P1</Badge>
            <Badge tone="warm">Structure</Badge>
            <Badge tone="cold">3 calls grouped</Badge>
          </div>
          <Meter label="Recommendation confidence" value={87} segments={16} />
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
            Human approval required // agent cannot self-dispatch
          </p>
        </div>
      </Modal>
    </>
  );
}
