import { fetchText } from "./fetch.js";
import type {
  BeachConfig,
  SafetyAdvisory,
  SafetySource,
} from "./types.js";

export const NS_PARKS_ADVISORIES_URL =
  "https://parks.novascotia.ca/advisories";

interface ParksAdvisory {
  title: string;
  message: string;
  url: string;
}

const ENTITY_VALUES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  quot: '"',
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return ENTITY_VALUES[code.toLowerCase()] ?? entity;
    },
  );
}

function plainText(html: string): string {
  return decodeEntities(
    html.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function firstTwoSentences(value: string): string {
  return value.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
}

// The Parks site does not publish a JSON or RSS representation. Keep this
// parser deliberately narrow: if Drupal's advisory-card markup changes, the
// build must fail instead of silently turning a parser failure into "all clear".
export function parseNovaScotiaParksAdvisories(html: string): ParksAdvisory[] {
  if (!/view-all-advisories/.test(html) || !/>\s*All Advisories\s*</i.test(html)) {
    throw new Error("Nova Scotia Parks advisory page marker was not found");
  }

  const rowCount = html.match(/\bviews-row\b/g)?.length ?? 0;
  const cardCount = html.match(/\badvisory-teaser-wrapper\b/g)?.length ?? 0;
  if (rowCount > 0 && cardCount === 0) {
    throw new Error("Nova Scotia Parks advisory rows no longer use advisory cards");
  }

  const cards: ParksAdvisory[] = [];
  const cardPattern =
    /<a\s+href="([^"]+)"[^>]*>\s*<div class="advisory-teaser-wrapper card">[\s\S]*?<span class="[^"]*field--name-title[^"]*">([\s\S]*?)<\/span>[\s\S]*?<div class="[^"]*field--name-body[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/a>/gi;

  for (const match of html.matchAll(cardPattern)) {
    const [, href, titleHtml, messageHtml] = match;
    cards.push({
      title: plainText(titleHtml),
      message: plainText(messageHtml),
      url: new URL(href, NS_PARKS_ADVISORIES_URL).toString(),
    });
  }

  if (cards.length !== cardCount) {
    throw new Error(
      `Parsed ${cards.length} of ${cardCount} Nova Scotia Parks advisory cards`,
    );
  }
  return cards;
}

export function parseNovaScotiaParksAdvisoryDetail(html: string): string {
  const article = html.match(
    /<article\b[^>]*class="[^"]*\bnode--type-advisory\b[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
  )?.[1];
  if (!article) {
    throw new Error("Nova Scotia Parks advisory detail marker was not found");
  }
  const body = article.match(
    /<div\b[^>]*class="[^"]*\bfield--name-body\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  if (!body) {
    throw new Error("Nova Scotia Parks advisory detail body was not found");
  }

  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plainText(match[1]))
    .filter((paragraph) => !/^\w+ \w+ \d{1,2}, \d{4}$/.test(paragraph));
  const guidance =
    paragraphs.find((paragraph) =>
      /swim|avoid (?:the )?water|bacteria|blue-green algae/i.test(paragraph),
    ) ?? plainText(body);
  if (!guidance) {
    throw new Error("Nova Scotia Parks advisory detail has no guidance text");
  }
  return firstTwoSentences(guidance);
}

function normalizedWords(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSwimmingAdvisory(advisory: ParksAdvisory): boolean {
  const text = normalizedWords(`${advisory.title} ${advisory.message}`);
  return [
    "swimming not advised",
    "swimming is not advised",
    "swimming not recommended",
    "swimming is not recommended",
    "closed to swimming",
    "advise no swimming",
    "avoid the water",
  ].some((phrase) => text.includes(phrase));
}

function mentionsBeach(advisory: ParksAdvisory, beachName: string): boolean {
  const haystack = ` ${normalizedWords(`${advisory.title} ${advisory.message}`)} `;
  const needle = ` ${normalizedWords(beachName)} `;
  return haystack.includes(needle);
}

export function matchNovaScotiaParksSwimmingAdvisories(
  advisories: ParksAdvisory[],
  beaches: Pick<BeachConfig, "id" | "name">[],
  checkedAt: Date,
): SafetyAdvisory[] {
  const matched: SafetyAdvisory[] = [];
  for (const advisory of advisories.filter(isSwimmingAdvisory)) {
    for (const beach of beaches.filter((entry) =>
      mentionsBeach(advisory, entry.name),
    )) {
      matched.push({
        beach_id: beach.id,
        type: "water-advisory",
        title: advisory.title,
        message: advisory.message,
        source: "Nova Scotia Parks",
        source_url: advisory.url,
        checked_at: checkedAt.toISOString(),
        status: "active",
      });
    }
  }
  return matched;
}

export async function fetchNovaScotiaParksSwimmingAdvisories(
  beaches: Pick<BeachConfig, "id" | "name">[],
  checkedAt: Date,
  validMinutes: number,
): Promise<{ advisories: SafetyAdvisory[]; source: SafetySource }> {
  const html = await fetchText(NS_PARKS_ADVISORIES_URL);
  const listed = parseNovaScotiaParksAdvisories(html);
  const relevant = listed.filter(
    (advisory) =>
      isSwimmingAdvisory(advisory) ||
      beaches.some((beach) => mentionsBeach(advisory, beach.name)),
  );
  const detailed = await Promise.all(
    relevant.map(async (advisory) => ({
      ...advisory,
      message: parseNovaScotiaParksAdvisoryDetail(
        await fetchText(advisory.url),
      ),
    })),
  );
  const advisories = matchNovaScotiaParksSwimmingAdvisories(
    detailed,
    beaches,
    checkedAt,
  );
  return {
    advisories,
    source: {
      provider: "Nova Scotia Parks",
      sourceUrl: NS_PARKS_ADVISORIES_URL,
      checkedAt: checkedAt.toISOString(),
      validUntil: new Date(
        checkedAt.getTime() + validMinutes * 60_000,
      ).toISOString(),
      kind: "current-advisories",
    },
  };
}
