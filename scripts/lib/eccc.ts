import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./fetch.js";
import type {
  CitypageData,
  DailyForecast,
  EcccWarning,
  HourlyWeather,
  XmlNode,
} from "./types.js";

const DATAMART = "https://dd.weather.gc.ca";
const MAX_LOOKBACK_HOURS = 12;

interface HourDir {
  url: string;
}

function utcDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// The datamart publishes citypage files into per-UTC-hour directories under a
// dated tree. Files are named <issueTime>_MSC_CitypageWeather_<site>_<lang>.xml
// and amended files land in the hour they were issued, so the latest file for
// a site is found by walking hour directories backwards from the current hour.
// Always address the dated tree, never the /today/ alias: the alias is
// resolved per request and flips at 00:00 UTC, which would 404 every lookback
// directory for a build that starts just before midnight.
function candidateHourDirs(province: string, now: Date): HourDir[] {
  const dirs: HourDir[] = [];
  for (let offset = 0; offset <= MAX_LOOKBACK_HOURS; offset++) {
    const t = new Date(now.getTime() - offset * 3600 * 1000);
    const hh = String(t.getUTCHours()).padStart(2, "0");
    dirs.push({
      url: `${DATAMART}/${utcDateStamp(t)}/WXO-DD/citypage_weather/${province}/${hh}/`,
    });
  }
  return dirs;
}

const listingCache = new Map<string, string[]>();

async function listDir(url: string): Promise<string[]> {
  const cached = listingCache.get(url);
  if (cached) return cached;
  let files: string[] = [];
  try {
    const html = await fetchText(url, 0);
    files = [...html.matchAll(/href="([^"?/][^"]*\.xml)"/g)].map((m) => m[1]);
  } catch {
    // Missing hour directories are normal early in the UTC day.
  }
  listingCache.set(url, files);
  return files;
}


export async function fetchLatestCitypage(
  province: string,
  siteCode: string,
  now: Date = new Date(),
): Promise<CitypageData> {
  for (const dir of candidateHourDirs(province, now)) {
    const files = await listDir(dir.url);
    const matches = files
      .filter((f) => f.endsWith(`_MSC_CitypageWeather_${siteCode}_en.xml`))
      .sort();
    if (matches.length === 0) continue;
    const fileUrl = dir.url + matches[matches.length - 1];
    const xml = await fetchText(fileUrl);
    return parseCitypage(xml, siteCode, fileUrl);
  }
  throw new Error(
    `No citypage file for ${siteCode} within ${MAX_LOOKBACK_HOURS}h lookback`,
  );
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const text = typeof value === "object" ? (value as XmlNode)["#text"] : value;
  if (text === undefined || text === null || text === "") return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return String((value as XmlNode)["#text"] ?? "");
  return String(value);
}

// dateTimeUTC attributes use the compact form YYYYMMDDHHmm.
function compactUtcToIso(stamp: string): string {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) throw new Error(`Unparseable UTC timestamp: ${stamp}`);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`;
}

function pickUtcTimestamp(dateTimes: unknown): string | null {
  for (const dt of asArray<XmlNode>(dateTimes)) {
    if (dt["@_zone"] === "UTC" && dt.timeStamp) {
      return compactUtcToIso(String(dt.timeStamp));
    }
  }
  return null;
}

export function parseCitypage(
  xml: string,
  siteCode: string,
  sourceUrl: string,
): CitypageData {
  const doc = parser.parse(xml);
  const site = doc.siteData;
  if (!site) throw new Error(`No siteData element in ${sourceUrl}`);

  const hourlyGroup = site.hourlyForecastGroup;
  let issuedAtUtc = pickUtcTimestamp(hourlyGroup?.dateTime);
  if (!issuedAtUtc) {
    throw new Error(`No hourly forecast issue time in ${sourceUrl}`);
  }

  // The datamart intermittently stamps forecastIssue with the file-generation
  // date while keeping the issuance hour, yielding timestamps up to a day in
  // the future. Roll back a day when the claimed issue time is ahead of the
  // document's own creation time; fall back to the creation time itself if
  // that still is not enough.
  const xmlCreation = pickUtcTimestamp(site.dateTime);
  if (xmlCreation && Date.parse(issuedAtUtc) > Date.parse(xmlCreation)) {
    const rolledBack = new Date(
      Date.parse(issuedAtUtc) - 24 * 3600 * 1000,
    ).toISOString();
    issuedAtUtc =
      Date.parse(rolledBack) <= Date.parse(xmlCreation) ? rolledBack : xmlCreation;
  }

  const hourly: HourlyWeather[] = asArray<XmlNode>(hourlyGroup?.hourlyForecast).map(
    (entry) => ({
      time: compactUtcToIso(String(entry["@_dateTimeUTC"])),
      temperatureC: toNumber(entry.temperature),
      humidexC: toNumber(entry.humidex),
      condition: toText(entry.condition),
      iconCode: toNumber(entry.iconCode),
      popPercent: toNumber(entry.lop) ?? 0,
      windKmh: toNumber(entry.wind?.speed),
      gustKmh: toNumber(entry.wind?.gust),
      windDirection:
        toText(entry.wind?.direction) === "VR"
          ? null
          : toText(entry.wind?.direction) || null,
    }),
  );
  if (hourly.length === 0) {
    throw new Error(`No hourly forecast entries in ${sourceUrl}`);
  }

  const warnings: EcccWarning[] = asArray<XmlNode>(site.warnings?.event).map(
    (event) => ({
      type: String(event["@_type"] ?? "unknown"),
      colour: event["@_alertColourLevel"]
        ? String(event["@_alertColourLevel"])
        : null,
      description: String(event["@_description"] ?? "").trim(),
      url: event["@_url"] ? String(event["@_url"]) : null,
    }),
  );

  const daily: DailyForecast[] = asArray<XmlNode>(site.forecastGroup?.forecast)
    .slice(0, 4)
    .map((forecast) => ({
      name: toText(forecast.period?.["@_textForecastName"] ?? forecast.period),
      summary: toText(forecast.textSummary),
      popPercent: toNumber(forecast.abbreviatedForecast?.pop),
    }));

  return {
    siteCode,
    issuedAtUtc,
    fetchedAt: new Date().toISOString(),
    sourceUrl,
    hourly,
    warnings,
    daily,
  };
}
