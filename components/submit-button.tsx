"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "quiet" | "voice" | "danger";

const VARIANT: Record<Variant, string> = {
  // The one popped element on a screen.
  primary: "bg-haldi border-2 border-ink shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  secondary: "bg-paper border-2 border-ink",
  quiet: "bg-transparent underline underline-offset-4 px-1",
  voice: "bg-neel border-2 border-ink",
  danger: "bg-paper border-2 border-ink text-ink",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  const shape = variant === "quiet" ? "" : "rounded-pill px-4 py-2";
  return `inline-flex items-center justify-center gap-2 font-bold text-ink disabled:opacity-60 ${shape} ${VARIANT[variant]} ${extra}`;
}

/** Form submit button that shows `pending` text while the action runs. */
export function SubmitButton({
  children,
  pending,
  variant = "secondary",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  pending?: ReactNode;
  variant?: Variant;
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={status.pending}
      className={buttonClass(variant, className)}
    >
      {status.pending ? (pending ?? "Working…") : children}
    </button>
  );
}
