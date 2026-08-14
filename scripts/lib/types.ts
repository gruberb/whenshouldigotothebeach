type Exposure =
  | "sheltered-bay"
  | "semi-exposed"
  | "open-atlantic"
  | "estuary"
  | "tidal-flat";

type Region =
  | "south-shore"
  | "yarmouth-acadian-shores"
  | "bay-of-fundy-annapolis-valley"
  | "northumberland-shore"
  | "halifax-metro"
  | "eastern-shore"
  | "cape-breton";

type TideEffect =
  | "neutral"
  | "more-sand-at-low"
  | "warmer-incoming-after-low"
  | "reduced-access-at-high"
  | "unknown";

export interface BeachConfig {
  id: string;
  name: string;
  region: Region;
  municipality: string;
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  classification: {
    surface: string;
    exposure: Exposure;
    shore_bearing_degrees: number;
    tide_effect: TideEffect;
    surf?: boolean;
  };
  weather: {
    site_code: string;
    site_latitude: number;
    site_longitude: number;
    site_name: string;
    province: string;
  };
  tide: {
    station_code: string;
    station_latitude: number;
    station_longitude: number;
    station_id: string;
    station_name: string;
    confidence: "on-site" | "nearby" | "regional";
  };
  water?: {
    buoy_id: string;
    buoy_name: string;
    buoy_latitude: number;
    buoy_longitude: number;
  };
  amenities?: {
    washrooms?: boolean;
    food?: boolean;
    note?: string;
  };
  source_urls: {
    official_page: string;
    surf_page?: string;
  };
  coverage: {
    status: string;
    reviewed_at: string;
  };
}

export interface Thresholds {
  weights: {
    precipitation: number;
    wind: number;
    temperature: number;
    fog: number;
    sky: number;
    tide: number;
  };
  temperature_c: {
    ideal_min: number;
    ideal_max: number;
    ok_min: number;
    ok_max: number;
    poor_min: number;
    poor_max: number;
  };
  wind_kmh: {
    calm_max: number;
    ok_max: number;
    windy_max: number;
    gust_factor: number;
  };
  precipitation_pop: {
    low_max: number;
    high_max: number;
  };
  ratings: {
    good_min: number;
    ok_min: number;
    meh_min: number;
  };
  window: {
    min_hours: number;
  };
  staleness: {
    valid_minutes: number;
  };
}

export interface ManualOverride {
  beach_id: string;
  type: "closure" | "water-advisory" | "informational";
  title: string;
  message: string;
  source: string;
  starts_at: string;
  expires_at: string;
}

export interface HourlyWeather {
  time: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: string;
  iconCode: number | null;
  popPercent: number;
  windKmh: number | null;
  gustKmh: number | null;
  windDirection: string | null;
}

export interface EcccWarning {
  type: string;
  colour: string | null;
  description: string;
  url: string | null;
}

export interface DailyForecast {
  name: string;
  summary: string;
  popPercent: number | null;
}

export interface CitypageData {
  siteCode: string;
  issuedAtUtc: string;
  fetchedAt: string;
  sourceUrl: string;
  hourly: HourlyWeather[];
  warnings: EcccWarning[];
  daily: DailyForecast[];
}

export interface GemForecast {
  latitude: number;
  longitude: number;
  fetchedAt: string;
  hourly: HourlyWeather[];
}

export interface TideEvent {
  time: string;
  type: "high" | "low";
  heightM: number;
}

export interface TideSample {
  time: string;
  heightM: number;
}

export interface TideData {
  stationCode: string;
  stationId: string;
  stationName: string;
  sourceKind: "predicted" | "unavailable";
  fetchedAt: string;
  events: TideEvent[];
  samples: TideSample[];
}

export interface NearbyFood {
  name: string;
  kind: string;
  distanceKm: number;
}

export interface WaterTemperature {
  sourceKind: "observed-buoy" | "unavailable";
  valueC: number | null;
  observedAt: string | null;
  stationName: string | null;
  distanceKm: number | null;
}

export type WindRelation = "onshore" | "offshore" | "cross-shore";
export type TidePhase = "low" | "rising" | "high" | "falling";
export type HourRating = "good" | "ok" | "meh" | "poor" | "night";

export interface ScoredHour {
  time: string;
  score: number;
  rating: HourRating;
  daylight: boolean;
  gated: boolean;
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: string;
  iconCode: number | null;
  popPercent: number;
  windKmh: number | null;
  gustKmh: number | null;
  windDirection: string | null;
  windRelation: WindRelation | null;
  tidePhase: TidePhase | null;
}

export interface BestWindow {
  start: string;
  end: string;
  quality: "good" | "ok";
  avgScore: number;
}

export type Verdict =
  | "GO_NOW"
  | "GOOD_LATER"
  | "MIXED"
  | "NOT_GREAT"
  | "WATER_ADVISORY"
  | "CLOSED"
  | "HAZARDOUS";

export interface SunTimes {
  date: string;
  sunrise: string;
  sunset: string;
}

type ReasonKind =
  | "thunder"
  | "rain"
  | "dry"
  | "fog"
  | "wind"
  | "offshore"
  | "temperature"
  | "heat"
  | "tide"
  | "none";

export interface Reason {
  kind: ReasonKind;
  text: string;
  short: string;
}

export type Confidence = "high" | "medium" | "low";

export interface BeachSummary {
  verdict: Verdict;
  bestWindow: BestWindow | null;
  reasons: Reason[];
  confidence: Confidence;
}

export interface ForecastDay {
  date: string;
  dayOffset: number;
  precisionHours: 1 | 3;
  summary: BeachSummary;
  hourly: ScoredHour[];
  advisories: ManualOverride[];
}

export interface BeachOutput {
  schemaVersion: number;
  beach: {
    id: string;
    name: string;
    region: Region;
    municipality: string;
    exposure: Exposure;
    surface: string;
    tideEffect: TideEffect;
    surf: boolean;
    latitude: number;
    longitude: number;
    officialPage: string;
    amenities: {
      washrooms: boolean | null;
      food: boolean | null;
      note: string | null;
    };
  };
  generatedAt: string;
  validUntil: string;
  timezone: string;
  days: ForecastDay[];
  sun: SunTimes[];
  tides: {
    stationCode: string;
    stationName: string;
    distanceKm: number;
    sourceKind: "predicted" | "unavailable";
    events: TideEvent[];
    samples: TideSample[];
  };
  water: WaterTemperature;
  nearbyFood: NearbyFood[];
  weatherSource: {
    provider: "Open-Meteo";
    model: "Canadian GEM seamless";
    latitude: number;
    longitude: number;
    distanceKm: number;
    fetchedAt: string;
    kind: "model-forecast";
  };
  officialForecastSource: {
    siteCode: string;
    siteName: string;
    distanceKm: number;
    issuedAt: string;
    fetchedAt: string;
    kind: "official-forecast";
  };
  warnings: EcccWarning[];
  advisories: ManualOverride[];
  outlook: DailyForecast[];
}

// fast-xml-parser hands back plain objects whose shape varies per feed and per
// element (attributes, "#text" nodes, single value vs array). The parsers pin
// that down with asArray/toNumber/toText at the point of use; a declared shape
// here would only be a guess that the feeds are free to break.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type XmlNode = any;
