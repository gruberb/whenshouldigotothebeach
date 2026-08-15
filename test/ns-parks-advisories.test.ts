import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  matchNovaScotiaParksSwimmingAdvisories,
  parseNovaScotiaParksAdvisoryDetail,
  parseNovaScotiaParksAdvisories,
} from "../scripts/lib/ns-parks-advisories.js";

const fixture = readFileSync(
  join(__dirname, "fixtures", "ns-parks", "advisories.html"),
  "utf8",
);
const detailFixture = readFileSync(
  join(__dirname, "fixtures", "ns-parks", "advisory-detail.html"),
  "utf8",
);

describe("Nova Scotia Parks advisories", () => {
  it("parses advisory cards and resolves their official URLs", () => {
    const parsed = parseNovaScotiaParksAdvisories(fixture);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      title: "Swimming Not Advised at Lawrencetown Beach",
      url: "https://parks.novascotia.ca/swimming-not-advised-lawrencetown-beach",
    });
    expect(parsed[0].message).toBe("Friday August 14, 2026");
  });

  it("extracts concise guidance from an advisory detail page", () => {
    expect(parseNovaScotiaParksAdvisoryDetail(detailFixture)).toBe(
      "Swimming is not recommended at Test Beach until further notice due to elevated bacteria. Please avoid the water – swimming may cause illness.",
    );
  });

  it("matches the current swimming notices but ignores boil-water notices", () => {
    const listed = parseNovaScotiaParksAdvisories(fixture);
    const detailed = listed.map((entry) =>
      entry.title.startsWith("Swimming Not Advised")
        ? {
            ...entry,
            message: parseNovaScotiaParksAdvisoryDetail(detailFixture).replace(
              "Test Beach",
              entry.title.includes("Lawrencetown")
                ? "Lawrencetown Beach"
                : "Rainbow Haven Beach",
            ),
          }
        : entry,
    );
    const matched = matchNovaScotiaParksSwimmingAdvisories(
      detailed,
      [
        { id: "lawrencetown", name: "Lawrencetown Beach" },
        { id: "rainbow-haven", name: "Rainbow Haven Beach" },
        { id: "rissers", name: "Rissers Beach" },
      ],
      new Date("2026-08-15T12:00:00Z"),
    );
    expect(matched.map((entry) => entry.beach_id)).toEqual([
      "lawrencetown",
      "rainbow-haven",
    ]);
    expect(matched[0]).toMatchObject({
      type: "water-advisory",
      source: "Nova Scotia Parks",
      checked_at: "2026-08-15T12:00:00.000Z",
      status: "active",
    });
  });

  it("fails closed when advisory-card markup changes", () => {
    const changed = fixture.replaceAll(
      "advisory-teaser-wrapper",
      "renamed-advisory-wrapper",
    );
    expect(() => parseNovaScotiaParksAdvisories(changed)).toThrow(
      /no longer use advisory cards/,
    );
  });
});
