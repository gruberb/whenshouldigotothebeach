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
  const index = beachIndexSchema.parse(readJson(join(dataDir, "beaches.json")));

  const indexIds = new Set(index.beaches.map((b) => b.id));
  for (const id of manifest.beachIds) {
    if (!indexIds.has(id)) {
      throw new Error(`Beach ${id} in manifest but missing from beaches.json`);
    }
    beachOutputSchema.parse(readJson(join(dataDir, "beach", `${id}.json`)));
  }

  const ageMinutes = (Date.now() - Date.parse(manifest.generatedAt)) / 60_000;
  if (ageMinutes > 60) {
    throw new Error(
      `Generated data is ${Math.round(ageMinutes)} minutes old; refusing to ship stale data`,
    );
  }

  console.log(`Validated data for ${manifest.beachIds.length} beaches`);
} catch (error) {
  console.error("Validation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
