import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFoodPois, resolveNearbyFood } from "./lib/nearby.js";
import { loadBeaches } from "./lib/registry.js";

// Food places change on the scale of months, not minutes, and road routing is
// slow, so both live behind this refresh script: it queries Overpass once,
// resolves ferry-free road distances per beach via Valhalla, and writes a
// committed per-beach snapshot the 30-minute pipeline reads from disk.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "config", "nearby-food.json");

const beaches = loadBeaches(join(root, "config", "beaches.yml"));
const pois = await fetchFoodPois();
if (pois.length < 100) {
  console.error(
    `Only ${pois.length} places returned; refusing to overwrite the snapshot with a suspiciously small result`,
  );
  process.exit(1);
}
console.log(`Fetched ${pois.length} named food places, routing per beach`);

const resolved: Record<string, unknown> = {};
for (const beach of beaches) {
  const nearby = await resolveNearbyFood(
    beach.location.latitude,
    beach.location.longitude,
    pois,
  );
  resolved[beach.id] = nearby;
  console.log(
    `${beach.id}: ${nearby.map((f) => `${f.name} ${f.distanceKm}km`).join(" · ") || "nothing within road range"}`,
  );
}

writeFileSync(
  target,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source:
        "OpenStreetMap via Overpass API (ODbL); road distances via Valhalla, ferries avoided",
      beaches: resolved,
    },
    null,
    1,
  ),
);
console.log(`Wrote snapshot to ${target}`);
