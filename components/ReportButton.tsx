"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Button, Modal, Notice, SelectInput, TextArea } from "./ui";
import { REPORT_REASONS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";

export default function ReportButton({ type, targetId, label = "Report" }: { type: "donation" | "listing" | "campaign" | "user"; targetId: string; label?: string }) {
  const { supabase, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("unsafe_food");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (!user) return null;

  async function submit() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("report_content", { p_type: type, p_target: targetId, p_reason: reason, p_details: details || null });
    setBusy(false);
    setMessage(error ? { tone: "error", text: friendlyError(error) } : { tone: "success", text: "Thank you. A moderator will review this." });
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMessage(null); }} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-muted underline-offset-4 hover:text-brand-ink hover:underline">
        <Flag className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report a problem">
        <div className="space-y-4">
          <SelectInput label="What is wrong?" value={reason} onChange={(e) => setReason(e.target.value)} options={REPORT_REASONS} />
          <TextArea label="Details (optional)" value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            {message?.tone !== "success" && (
              <Button onClick={() => void submit()} loading={busy}>
                Send report
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
