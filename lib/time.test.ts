import { describe, expect, it } from "vitest";

import { addDays, endOfIstDay, istDate, upcomingVisitDate } from "./time";

describe("IST dates", () => {
  it("uses the IST calendar day, not UTC", () => {
    // 20:00 UTC on 2 Oct is 01:30 IST on 3 Oct.
    expect(istDate(new Date("2026-10-02T20:00:00Z"))).toBe("2026-10-03");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("ends the IST day at 18:29:59.999 UTC", () => {
    expect(endOfIstDay("2026-10-03").toISOString()).toBe("2026-10-03T18:29:59.999Z");
  });
});

describe("upcomingVisitDate", () => {
  it("is today before the visit ends", () => {
    // 07:00 IST
    expect(upcomingVisitDate("12:30", 60, new Date("2026-10-03T01:30:00Z"))).toBe("2026-10-03");
    // 13:00 IST, mid-visit
    expect(upcomingVisitDate("12:30", 60, new Date("2026-10-03T07:30:00Z"))).toBe("2026-10-03");
  });

  it("is tomorrow after the visit ends", () => {
    // 20:30 IST, when the nightly cron runs
    expect(upcomingVisitDate("12:30", 60, new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-04");
  });
});
