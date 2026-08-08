import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFoodPois } from "./lib/nearby.js";

// Food places change on the scale of months, not minutes, so they live as a
// committed snapshot refreshed by a weekly workflow (or by hand) instead of
// hitting Overpass on every 30-minute pipeline run.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "config", "nearby-food.json");

const pois = await fetchFoodPois();
if (pois.length < 100) {
  console.error(
    `Only ${pois.length} places returned; refusing to overwrite the snapshot with a suspiciously small result`,
  );
  process.exit(1);
}

pois.sort(
  (a, b) => a.name.localeCompare(b.name) || a.latitude - b.latitude,
);
writeFileSync(
  target,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "OpenStreetMap via Overpass API (ODbL)",
      pois,
    },
    null,
    1,
  ),
);
console.log(`Wrote ${pois.length} food places to ${target}`);
