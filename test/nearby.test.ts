import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nearestFood, parseOverpassFood } from "../scripts/lib/nearby.js";

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
      expect(["restaurant", "cafe", "takeout", "bakery"]).toContain(poi.kind);
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

describe("nearestFood", () => {
  const pois = parseOverpassFood(json);

  it("returns the closest places sorted by distance", () => {
    const nearby = nearestFood(44.2672, -64.2594, pois);
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < nearby.length; i++) {
      expect(nearby[i].distanceKm).toBeGreaterThanOrEqual(
        nearby[i - 1].distanceKm,
      );
    }
  });

  it("deduplicates node and way entries for the same venue", () => {
    const nearby = nearestFood(44.05686, -64.640154, pois, 3);
    const names = nearby.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("returns nothing when no place is within range", () => {
    expect(nearestFood(45.9, -60.0, pois)).toEqual([]);
  });
});
