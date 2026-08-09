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

// South Shore bounding box. Rural food often lives in general and convenience
// stores (the Rose Bay General Store problem), so shops are included alongside
// restaurants, cafes, and bakeries.
const QUERY = `[out:json][timeout:240];
(
  node["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](43.3,-66.6,47.2,-59.4);
  way["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](43.3,-66.6,47.2,-59.4);
  node["shop"~"^(bakery|general|convenience|deli)$"]["name"](43.3,-66.6,47.2,-59.4);
  way["shop"~"^(bakery|general|convenience|deli)$"]["name"](43.3,-66.6,47.2,-59.4);
);
out center;`;

const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const MAX_CROW_KM = 25;
const MAX_ROAD_KM = 20;
const CANDIDATES_PER_BEACH = 10;

interface FoodPoi {
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
  general: "store",
  convenience: "store",
  deli: "deli",
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
    const rawKind = tags.amenity ?? tags.shop ?? null;
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
        300_000,
      );
      return parseOverpassFood(body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// Driving distance with ferries avoided: a bakery 5 km across the river is a
// 40 km drive around it, and pretending otherwise misleads.
async function roadDistanceKm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): Promise<number | null> {
  const body = JSON.stringify({
    locations: [
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    ],
    costing: "auto",
    costing_options: { auto: { use_ferry: 0 } },
    units: "kilometers",
  });
  try {
    const response = await fetchText(
      `${VALHALLA}?json=${encodeURIComponent(body)}`,
      1,
      30_000,
    );
    const trip = JSON.parse(response).trip;
    if (!trip || trip.summary?.has_ferry) return null;
    const km = trip.summary?.length;
    return typeof km === "number" ? Math.round(km * 10) / 10 : null;
  } catch {
    return null;
  }
}

// Candidate places for road routing: nearest distinct names by straight line.
// OSM often carries a node and a way for the same venue, so deduplicate by
// name keeping the closer one.
export function nearestCandidates(
  latitude: number,
  longitude: number,
  pois: FoodPoi[],
  limit = CANDIDATES_PER_BEACH,
): (FoodPoi & { crowKm: number })[] {
  const byName = new Map<string, FoodPoi & { crowKm: number }>();
  for (const poi of pois) {
    const crowKm = haversineKm(latitude, longitude, poi.latitude, poi.longitude);
    if (crowKm > MAX_CROW_KM) continue;
    const existing = byName.get(poi.name);
    if (!existing || crowKm < existing.crowKm) {
      byName.set(poi.name, { ...poi, crowKm });
    }
  }
  return [...byName.values()]
    .sort((a, b) => a.crowKm - b.crowKm)
    .slice(0, limit);
}

export async function resolveNearbyFood(
  latitude: number,
  longitude: number,
  pois: FoodPoi[],
  limit = 2,
): Promise<NearbyFood[]> {
  const resolved: NearbyFood[] = [];
  for (const candidate of nearestCandidates(latitude, longitude, pois)) {
    const distanceKm = await roadDistanceKm(
      latitude,
      longitude,
      candidate.latitude,
      candidate.longitude,
    );
    if (distanceKm === null || distanceKm > MAX_ROAD_KM) continue;
    resolved.push({ name: candidate.name, kind: candidate.kind, distanceKm });
    await new Promise((r) => setTimeout(r, 600));
  }
  return resolved.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
}

const snapshotSchema = z.object({
  fetchedAt: z.string(),
  source: z.string(),
  beaches: z.record(
    z.string(),
    z.array(
      z.object({
        name: z.string().min(1),
        kind: z.string().min(1),
        distanceKm: z.number().min(0),
      }),
    ),
  ),
});

// The committed snapshot holds per-beach resolved lists with road distances;
// scripts/refresh-food.ts rebuilds it weekly so builds stay offline-fast.
export function loadFoodSnapshot(path: string): Record<string, NearbyFood[]> {
  return snapshotSchema.parse(JSON.parse(readFileSync(path, "utf8"))).beaches;
}
