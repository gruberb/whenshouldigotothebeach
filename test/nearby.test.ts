import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadFoodSnapshot,
  nearestCandidates,
  parseOverpassFood,
} from "../scripts/lib/nearby.js";

const json = readFileSync(
  join(__dirname, "fixtures", "osm", "overpass-food.json"),
  "utf8",
);

describe("parseOverpassFood", () => {
  const pois = parseOverpassFood(json);

  it("extracts named food places with coordinates", () => {
    expect(pois.length).toBeGreaterThan(5);
    for (const poi of pois) {
      expect(poi.name.length).toBeGreaterThan(0);
      expect(["restaurant", "cafe", "takeout", "bakery", "store", "deli"]).toContain(
        poi.kind,
      );
      expect(Number.isFinite(poi.latitude)).toBe(true);
      expect(Number.isFinite(poi.longitude)).toBe(true);
    }
  });

  it("skips elements without a resolvable position or name", () => {
    const broken = JSON.stringify({
      elements: [
        { type: "node", tags: { amenity: "restaurant", name: "No coords" } },
        { type: "node", lat: 44.1, lon: -64.5, tags: { amenity: "restaurant" } },
      ],
    });
    expect(parseOverpassFood(broken)).toEqual([]);
  });
});

describe("nearestCandidates", () => {
  const pois = parseOverpassFood(json);

  it("returns the closest places sorted by straight-line distance", () => {
    const candidates = nearestCandidates(44.2672, -64.2594, pois);
    expect(candidates.length).toBeGreaterThan(0);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].crowKm).toBeGreaterThanOrEqual(
        candidates[i - 1].crowKm,
      );
    }
  });

  it("deduplicates node and way entries for the same venue", () => {
    const candidates = nearestCandidates(44.05686, -64.640154, pois);
    const names = candidates.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("returns nothing when no place is within range", () => {
    expect(nearestCandidates(45.9, -60.0, pois)).toEqual([]);
  });
});

describe("loadFoodSnapshot", () => {
  it("loads and validates the committed per-beach snapshot", () => {
    const snapshot = loadFoodSnapshot(
      join(__dirname, "..", "config", "nearby-food.json"),
    );
    expect(Object.keys(snapshot).length).toBeGreaterThanOrEqual(12);
    for (const entries of Object.values(snapshot)) {
      for (const entry of entries) {
        expect(entry.distanceKm).toBeLessThanOrEqual(20);
      }
    }
  });
});
