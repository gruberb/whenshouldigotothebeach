import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyExtrema } from "../scripts/lib/chs.js";

const readings = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "chs", "lunenburg-hilo.json"), "utf8"),
);

describe("classifyExtrema", () => {
  it("classifies real predictions as alternating lows and highs", () => {
    const events = classifyExtrema(readings);
    expect(events.length).toBe(readings.length);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].type).not.toBe(events[i - 1].type);
    }
  });

  it("classifies the fixture's first events correctly", () => {
    const events = classifyExtrema(readings);
    expect(events[0]).toMatchObject({ type: "low" });
    expect(events[1]).toMatchObject({ type: "high" });
  });

  it("classifies edge events against the single available neighbour", () => {
    const events = classifyExtrema([
      { eventDate: "2026-08-08T00:00:00Z", value: 2.0 },
      { eventDate: "2026-08-08T06:00:00Z", value: 0.5 },
    ]);
    expect(events[0].type).toBe("high");
    expect(events[1].type).toBe("low");
  });

  it("sorts events chronologically", () => {
    const events = classifyExtrema([
      { eventDate: "2026-08-08T06:00:00Z", value: 0.5 },
      { eventDate: "2026-08-08T00:00:00Z", value: 2.0 },
    ]);
    expect(Date.parse(events[0].time)).toBeLessThan(Date.parse(events[1].time));
  });
});
