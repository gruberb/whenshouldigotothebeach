export type Exposure =
  | "sheltered-bay"
  | "semi-exposed"
  | "open-atlantic"
  | "estuary"
  | "tidal-flat";

export type TideEffect =
  | "neutral"
  | "more-sand-at-low"
  | "warmer-incoming-after-low"
  | "reduced-access-at-high"
  | "unknown";

export interface BeachConfig {
  id: string;
  name: string;
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
  humidexC: number | null;
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
  humidexC: number | null;
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

export interface BeachSummary {
  verdict: Verdict;
  bestWindow: BestWindow | null;
  reasons: string[];
  confidence: "high" | "medium" | "low";
}

export interface BeachOutput {
  schemaVersion: number;
  beach: {
    id: string;
    name: string;
    municipality: string;
    exposure: Exposure;
    surface: string;
    tideEffect: TideEffect;
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
  summary: BeachSummary;
  hourly: ScoredHour[];
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
    siteCode: string;
    siteName: string;
    distanceKm: number;
    issuedAt: string;
    fetchedAt: string;
    kind: "forecast";
  };
  warnings: EcccWarning[];
  advisories: ManualOverride[];
  outlook: DailyForecast[];
}
