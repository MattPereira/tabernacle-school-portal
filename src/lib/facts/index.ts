// The runtime FACTS API client. Read-only by construction: this module exposes
// no way to write to FACTS, because the portal never does (ADR-0005).
//
// Wiring: auth headers, paging, and the rate-limit budget. What each response
// projects down to lives in ./normalize, so it can be tested without a fetch.
import {
  type FactsGradeLevel,
  type FactsHomeroom,
  type FactsPerson,
  type FactsRow,
  type FactsStaff,
  type FactsStudent,
  toActiveStaff,
  toGradeLevels,
  toHomerooms,
  toPeople,
  toStudents,
} from "./normalize";

export type {
  FactsGradeLevel,
  FactsHomeroom,
  FactsPerson,
  FactsStaff,
  FactsStudent,
} from "./normalize";

const BASE_URL = "https://api.factsmgt.com";
const MAX_PER_WINDOW = 100; // the API allows 100 requests...
const WINDOW_MS = 60_000; // ...per rolling 60s window
const PAD_MS = 2_000; // safety pad so we clear the window edge
const PAGE_SIZE = 1000;
const ID_CHUNK = 200; // personIds per /People request, to keep URLs sane

// The seam sync is written against. Five reads, no join — composing them is a
// rule, so it lives in lib/sync where it can be tested, not in this wiring.
export type FactsClient = {
  // Currently-enrolled students only; FACTS filters server-side.
  fetchEnrolledStudents(): Promise<FactsStudent[]>;
  // Currently-active staff only.
  fetchActiveStaff(): Promise<FactsStaff[]>;
  // Names, contact emails and birthdates for the given personIds, chunked
  // internally.
  fetchPeople(personIds: number[]): Promise<FactsPerson[]>;
  // Every homeroom assignment the school has. Unfiltered and unfilterable by
  // year, but verified to contain only currently enrolled students — it is a
  // live current-year view, which is why no school year is stored (#54).
  fetchHomerooms(): Promise<FactsHomeroom[]>;
  // The school's grade levels, in the school's own order.
  fetchGradeLevels(): Promise<FactsGradeLevel[]>;
};

export type FactsConfig = {
  // Static-key auth: both headers are required on every request.
  subscriptionKey: string;
  apiKey: string;
  baseUrl?: string;
  // Injected so tests can drive the rate limiter without real time or network.
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: Pick<Console, "warn">;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createFactsClient(config: FactsConfig): FactsClient {
  const {
    subscriptionKey,
    apiKey,
    baseUrl = BASE_URL,
    fetch: doFetch = globalThis.fetch,
    sleep = defaultSleep,
    now = Date.now,
    log = console,
  } = config;

  const headers = {
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "Facts-Api-Key": apiKey,
  };

  // Every request in this client goes through one queue, so the sliding window
  // below is the whole budget — concurrent callers can't overspend it.
  let chain: Promise<unknown> = Promise.resolve();
  const fireTimes: number[] = [];

  // Block until firing now keeps us within MAX_PER_WINDOW over WINDOW_MS.
  async function awaitSlot() {
    for (;;) {
      const at = now();
      while (fireTimes.length && at - fireTimes[0] >= WINDOW_MS) fireTimes.shift();
      if (fireTimes.length < MAX_PER_WINDOW) return;
      await sleep(WINDOW_MS - (at - fireTimes[0]) + PAD_MS);
    }
  }

  async function get(path: string, params: Record<string, string>): Promise<FactsPage> {
    await awaitSlot();
    fireTimes.push(now());

    const qs = new URLSearchParams({ "api-version": "1", ...params }).toString();
    const url = `${baseUrl}${path}?${qs}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await doFetch(url, { headers });
      if (res.status === 429) {
        // Shouldn't happen with the sliding window, but back off if the server
        // disagrees about our budget.
        const retry = Number(res.headers.get("retry-after")) || 60;
        log.warn(`[facts] 429 rate-limited, waiting ${retry}s`);
        await sleep(retry * 1000);
        fireTimes.push(now()); // the rejected attempt still spent budget
        continue;
      }
      if (!res.ok) {
        throw new Error(`GET ${path} -> ${res.status} ${res.statusText}: ${await res.text()}`);
      }
      return (await res.json()) as FactsPage;
    }
    throw new Error(`GET ${path} -> gave up after repeated 429s`);
  }

  // Serialize onto the queue whatever the previous call did — a failure must
  // not wedge the chain for everyone behind it.
  function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const queued = chain.then(run, run);
    chain = queued.catch(() => {});
    return queued;
  }

  async function getAll(path: string, params: Record<string, string> = {}): Promise<FactsRow[]> {
    return enqueue(async () => {
      const rows: FactsRow[] = [];
      let page = 1;
      let pageCount = 1;
      do {
        const data = await get(path, { ...params, Page: String(page), PageSize: String(PAGE_SIZE) });
        rows.push(...(data.results ?? []));
        pageCount = data.pageCount ?? 1;
        page++;
      } while (page <= pageCount);
      return rows;
    });
  }

  return {
    async fetchEnrolledStudents() {
      return toStudents(await getAll("/Students", { Filters: "school.status==Enrolled" }));
    },

    async fetchActiveStaff() {
      return toActiveStaff(await getAll("/people/Staff"));
    },

    async fetchHomerooms() {
      return toHomerooms(await getAll("/People/StudentsHomeroom"));
    },

    async fetchGradeLevels() {
      return toGradeLevels(await getAll("/Academics/GradeLevels"));
    },

    async fetchPeople(personIds) {
      const ids = [...new Set(personIds)].filter((id) => Number.isFinite(id));
      const rows: FactsRow[] = [];
      for (let i = 0; i < ids.length; i += ID_CHUNK) {
        // Sieve OR syntax — filtering by id beats sweeping all ~9k people.
        const chunk = ids.slice(i, i + ID_CHUNK);
        rows.push(...(await getAll("/People", { Filters: `personId==${chunk.join("|")}` })));
      }
      return toPeople(rows);
    },
  };
}

type FactsPage = {
  results?: FactsRow[];
  pageCount?: number;
};
