// Callers need to tell "the server says this is not here" apart from "we never
// reached the server". A missing directory is routine; an unreachable datamart
// is not, and reporting the second as the first turns an upstream outage into a
// confident "no forecast exists".
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
  }
}

// undici reports every network-level failure as the same "fetch failed", with
// the reason people actually need (ECONNRESET, ETIMEDOUT, DNS) hidden on
// .cause. Logging the bare message turns a diagnosable outage into a shrug.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  if (cause === undefined || cause === null) return error.message;
  const detail =
    cause instanceof Error
      ? `${cause.name}: ${cause.message}`
      : String(cause);
  return `${error.message} (${detail})`;
}

export async function fetchText(
  url: string,
  retries = 2,
  timeoutMs = 30_000,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "whenshouldigotothebeach.ca data pipeline" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new HttpError(response.status, url);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      // A 4xx other than 408/429 is a definitive answer, and the citypage
      // lookback walks hour directories that routinely do not exist yet.
      // Retrying those would add a request and a backoff to the normal path.
      const definitive =
        error instanceof HttpError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429;
      if (definitive) break;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, retries = 2): Promise<T> {
  const text = await fetchText(url, retries);
  return JSON.parse(text) as T;
}
