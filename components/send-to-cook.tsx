"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markSentAction } from "@/app/(app)/actions";
import { buttonClass } from "@/components/submit-button";

/**
 * Shares the mp3 through the phone's share sheet (pick WhatsApp, then the
 * cook's chat) and marks the plan sent. Falls back to a download.
 */
export function SendToCook({ planId, date, version }: { planId: string; date: string; version: number }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const markSent = () =>
    startTransition(async () => {
      await markSentAction(planId);
      router.refresh();
    });

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/plans/${planId}/audio?v=${version}`);
      if (!res.ok) throw new Error("download");
      const file = new File([await res.blob()], `cook-${date}.mp3`, { type: "audio/mpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Cook ${date}` });
          markSent();
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") return; // closed the share sheet
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setNote("Downloaded. Send it from WhatsApp, then tap Mark as sent.");
    } catch {
      setNote("Couldn't get the audio. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={share} disabled={busy || pending} className={buttonClass("primary", "py-3")}>
          {busy ? "Getting the audio…" : "Send to cook"}
        </button>
        <button type="button" onClick={markSent} disabled={pending} className={buttonClass("secondary")}>
          {pending ? "Marking…" : "Mark as sent"}
        </button>
      </div>
      {note && (
        <p className="text-small" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

/** For when the voice failed: copy the script to paste into WhatsApp. */
export function CopyScript({ planId, script }: { planId: string; script: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className={buttonClass("primary")}
        onClick={async () => {
          await navigator.clipboard.writeText(script);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy text for WhatsApp"}
      </button>
      <button
        type="button"
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() =>
          startTransition(async () => {
            await markSentAction(planId);
            router.refresh();
          })
        }
      >
        {pending ? "Marking…" : "Mark as sent"}
      </button>
    </div>
  );
}
