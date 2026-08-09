import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText } from "./lib/fetch.js";
import { loadBeaches } from "./lib/registry.js";
import { fetchBuoySeaSurfaceTemp } from "./lib/water.js";

// Answers one question: is the water temperature on the site missing because
// of us, or because ECCC stopped publishing? It runs the same code path as the
// data build rather than a parallel implementation, so a pass here means the
// pipeline would get a reading too.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATAMART = "https://dd.weather.gc.ca";

// Optional ISO timestamp to ask "was the feed up then?", which is also how the
// healthy path stays exercised while the feed is down.
const at = process.argv[2];
const now = at ? new Date(at) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`Unparseable timestamp: ${at}`);
  process.exit(2);
}
const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");

const beaches = loadBeaches(join(root, "config", "beaches.yml"));
const buoys = new Map<string, { name: string; beaches: string[] }>();
for (const beach of beaches) {
  if (!beach.water) continue;
  const entry = buoys.get(beach.water.buoy_id) ?? {
    name: beach.water.buoy_name,
    beaches: [],
  };
  entry.beaches.push(beach.id);
  buoys.set(beach.water.buoy_id, entry);
}

console.log(`UTC day ${stamp}, checked at ${now.toISOString()}`);

// The whole marine subtree goes missing during an outage, not just the files
// inside it, so report that separately from any individual buoy.
const treeUrl = `${DATAMART}/${stamp}/WXO-DD/observations/swob-ml/marine/moored-buoys/${stamp}/`;
let published: string[] = [];
try {
  const html = await fetchText(treeUrl, 0);
  published = [...html.matchAll(/href="(\d{5,7})\//g)].map((m) => m[1]);
  console.log(`marine tree: published, ${published.length} buoys`);
} catch (error) {
  console.log(`marine tree: ABSENT (${(error as Error).message})`);
}

let failed = 0;
for (const [id, { name, beaches: served }] of [...buoys].sort()) {
  const label = `${id} ${name}`.padEnd(34);
  const serves = `${served.length} beach${served.length === 1 ? "" : "es"}`;
  const listed = published.length === 0 || published.includes(id);
  try {
    const observation = await fetchBuoySeaSurfaceTemp(id, now);
    const ageMin = Math.round(
      (now.getTime() - Date.parse(observation.observedAt)) / 60_000,
    );
    console.log(
      `  ${label} ${observation.valueC}C  ${ageMin} min old  (${serves})`,
    );
  } catch (error) {
    failed++;
    const why = listed ? "" : "; not in today's listing";
    console.log(
      `  ${label} NO READING: ${(error as Error).message}${why}  (${serves})`,
    );
  }
}

if (failed > 0) {
  console.log(
    `\n${failed} of ${buoys.size} buoys have no usable reading. Those beaches ` +
      `show no water temperature until the feed returns; nothing to fix here.\n` +
      `Outage notices: https://comm.collab.science.gc.ca/mailman3/hyperkitty/list/dd_info@comm.collab.science.gc.ca/`,
  );
  process.exit(1);
}
console.log(`\nAll ${buoys.size} buoys reporting.`);
