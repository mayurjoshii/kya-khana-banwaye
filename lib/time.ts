// Dates and times in IST. Plans are keyed by the visit date in IST, whatever
// timezone the server (Vercel, UTC) runs in.

export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;

/** YYYY-MM-DD for the given instant, in IST. */
export function istDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Minutes since midnight in IST. */
export function istMinutes(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "12:30" or "12:30:00" -> minutes since midnight. */
export function parseClock(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * The visit the app is working towards: today until the visit is over,
 * tomorrow after that.
 */
export function upcomingVisitDate(
  visitTime: string,
  visitMinutes: number,
  at: Date = new Date(),
): string {
  const today = istDate(at);
  const visitEnd = parseClock(visitTime) + visitMinutes;
  return istMinutes(at) < visitEnd ? today : addDays(today, 1);
}

/** The instant at the end of the given IST day (23:59:59.999 IST). */
export function endOfIstDay(date: string): Date {
  const midnightUtc = Date.parse(`${addDays(date, 1)}T00:00:00Z`);
  return new Date(midnightUtc - IST_OFFSET_MINUTES * 60_000 - 1);
}

/** "Fri 3 Oct" */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** "3 Oct, 20:31" in IST */
export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** Milliseconds since an ISO timestamp. */
export function msSince(iso: string): number {
  return Date.now() - Date.parse(iso);
}
