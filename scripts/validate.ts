import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beachIndexSchema, beachOutputSchema, manifestSchema } from "./lib/schema.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "public", "data");

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    throw new Error(`Missing generated file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

try {
  const manifest = manifestSchema.parse(readJson(join(dataDir, "manifest.json")));
  const todayIndex = beachIndexSchema.parse(readJson(join(dataDir, "beaches.json")));
  if (todayIndex.date !== manifest.dates[0]) {
    throw new Error("beaches.json does not contain the first selectable date");
  }

  for (const date of manifest.dates) {
    const index = beachIndexSchema.parse(
      readJson(join(dataDir, "day", `${date}.json`)),
    );
    if (index.date !== date) throw new Error(`Day index date mismatch for ${date}`);
    const indexIds = new Set(index.beaches.map((beach) => beach.id));
    for (const id of manifest.beachIds) {
      if (!indexIds.has(id)) {
        throw new Error(`Beach ${id} missing from day index ${date}`);
      }
    }
  }

  for (const id of manifest.beachIds) {
    const beach = beachOutputSchema.parse(
      readJson(join(dataDir, "beach", `${id}.json`)),
    );
    const beachDates = beach.days.map((day) => day.date);
    if (beachDates.join(",") !== manifest.dates.join(",")) {
      throw new Error(`Beach ${id} does not contain every selectable date`);
    }
  }

  const ageMinutes = (Date.now() - Date.parse(manifest.generatedAt)) / 60_000;
  if (ageMinutes > 60) {
    throw new Error(
      `Generated data is ${Math.round(ageMinutes)} minutes old; refusing to ship stale data`,
    );
  }

  console.log(
    `Validated ${manifest.dates.length} days for ${manifest.beachIds.length} beaches`,
  );
} catch (error) {
  console.error("Validation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
