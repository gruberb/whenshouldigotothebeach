import { readFileSync } from "node:fs";
import { z } from "zod";
import { fetchText } from "./fetch.js";
import { haversineKm } from "./geo.js";
import type { NearbyFood } from "./types.js";

// Overpass mirrors, tried in order; the public main instance sheds load often.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// South Shore bounding box; one query per pipeline run covers every beach.
const QUERY = `[out:json][timeout:90];
(
  node["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](43.3,-66.0,44.9,-63.3);
  way["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](43.3,-66.0,44.9,-63.3);
  node["shop"="bakery"]["name"](43.3,-66.0,44.9,-63.3);
  way["shop"="bakery"]["name"](43.3,-66.0,44.9,-63.3);
);
out center;`;

const MAX_DISTANCE_KM = 20;

export interface FoodPoi {
  name: string;
  kind: string;
  latitude: number;
  longitude: number;
}

const KIND_LABELS: Record<string, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  fast_food: "takeout",
  bakery: "bakery",
};

export function parseOverpassFood(json: string): FoodPoi[] {
  const doc = JSON.parse(json);
  const pois: FoodPoi[] = [];
  for (const element of doc.elements ?? []) {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const name = tags.name;
    if (latitude === undefined || longitude === undefined || !name) continue;
    const rawKind = tags.amenity ?? (tags.shop === "bakery" ? "bakery" : null);
    if (!rawKind || !(rawKind in KIND_LABELS)) continue;
    pois.push({
      name: String(name),
      kind: KIND_LABELS[rawKind],
      latitude,
      longitude,
    });
  }
  return pois;
}

export async function fetchFoodPois(): Promise<FoodPoi[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    try {
      const body = await fetchText(
        `${endpoint}?data=${encodeURIComponent(QUERY)}`,
        0,
        120_000,
      );
      return parseOverpassFood(body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const snapshotSchema = z.object({
  fetchedAt: z.string(),
  source: z.string(),
  pois: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.string().min(1),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .min(100),
});

// The committed snapshot is reference data like beaches.yml: required and
// validated, refreshed by scripts/refresh-food.ts rather than at build time.
export function loadFoodPois(path: string): FoodPoi[] {
  return snapshotSchema.parse(JSON.parse(readFileSync(path, "utf8"))).pois;
}

// Nearest distinct places by straight-line distance. OSM often carries a node
// and a way for the same venue, so deduplicate by name keeping the closer one.
export function nearestFood(
  latitude: number,
  longitude: number,
  pois: FoodPoi[],
  limit = 2,
): NearbyFood[] {
  const byName = new Map<string, NearbyFood>();
  for (const poi of pois) {
    const distanceKm =
      Math.round(
        haversineKm(latitude, longitude, poi.latitude, poi.longitude) * 10,
      ) / 10;
    if (distanceKm > MAX_DISTANCE_KM) continue;
    const existing = byName.get(poi.name);
    if (!existing || distanceKm < existing.distanceKm) {
      byName.set(poi.name, { name: poi.name, kind: poi.kind, distanceKm });
    }
  }
  return [...byName.values()]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
