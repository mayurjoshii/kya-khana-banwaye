// Small shared building blocks that follow the design system: pills for
// buttons and chips, radius-lg cards, ink text on every accent.

import type { ComponentProps, ReactNode } from "react";

type Tone = "haldi" | "kothimbir" | "mirchi" | "neel" | "plain";

const TONE_BG: Record<Tone, string> = {
  haldi: "bg-haldi",
  kothimbir: "bg-kothimbir",
  mirchi: "bg-mirchi",
  neel: "bg-neel",
  plain: "bg-paper-2",
};

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`rounded-lg bg-paper-2 p-6 ${className}`} {...props} />;
}

export function Chip({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 text-label text-ink ${TONE_BG[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <h1 className="text-title">{children}</h1>
      {aside}
    </header>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-heading">{children}</h2>;
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-small text-ink-muted ${className}`}>{children}</p>;
}

export function Notice({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`rounded-sm px-4 py-3 text-small text-ink ${TONE_BG[tone]}`} role="status">
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-sm border-2 border-ink bg-paper px-4 py-2 text-body text-ink placeholder:text-ink-muted";

export const labelClass = "mb-1 block text-label text-ink";
