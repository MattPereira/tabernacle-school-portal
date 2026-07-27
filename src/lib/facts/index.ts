// The runtime FACTS API client. Read-only by construction: this module exposes
// no way to write to FACTS, because the portal never does (ADR-0005).
//
// The Swagger contract lives in reference/facts/api-definitions.json — read it
// there, don't re-derive it from this file (docs/conventions.md §5).

const BASE_URL = "https://api.factsmgt.com";
const MAX_PER_WINDOW = 100; // the API allows 100 requests...
const WINDOW_MS = 60_000; // ...per rolling 60s window
const PAD_MS = 2_000; // safety pad so we clear the window edge
const PAGE_SIZE = 1000;
const ID_CHUNK = 200; // personIds per /People request, to keep URLs sane

// What sync consumes. Normalized off the wire here so the rule module never
// learns FACTS' JSON shape — it sees people, students and staff.
export type FactsPerson = {
  personId: number;
  firstName: string | null;
  lastName: string | null;
  // Contact email. FACTS owns it; staff access derives from an exact match.
  contactEmail: string | null;
};

export type FactsStudent = {
  studentId: number;
  gradeLevel: string | null;
  status: string | null;
};

export type FactsStaff = {
  staffId: number;
};

// The seam sync is written against. Three reads, no join — composing them is a
// rule, so it lives in lib/sync where it can be tested, not in this wiring.
export type FactsClient = {
  // Currently-enrolled students only; FACTS filters server-side.
  fetchEnrolledStudents(): Promise<FactsStudent[]>;
  // Currently-active staff only.
  fetchActiveStaff(): Promise<FactsStaff[]>;
  // Names and contact emails for the given personIds, chunked internally.
  fetchPeople(personIds: number[]): Promise<FactsPerson[]>;
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
      const rows = await getAll("/Students", { Filters: "school.status==Enrolled" });
      return rows.map((row) => ({
        studentId: Number(row.studentId),
        gradeLevel: row.school?.gradeLevel ?? null,
        status: row.school?.status ?? null,
      }));
    },

    async fetchActiveStaff() {
      const rows = await getAll("/people/Staff");
      // The endpoint returns former staff too; `active` is the live flag. This
      // is a *staff* flag, not FACTS' junk `administrator` role signal.
      return rows.filter((row) => row.active).map((row) => ({ staffId: Number(row.staffId) }));
    },

    async fetchPeople(personIds) {
      const ids = [...new Set(personIds)].filter((id) => Number.isFinite(id));
      const rows: FactsRow[] = [];
      for (let i = 0; i < ids.length; i += ID_CHUNK) {
        // Sieve OR syntax — filtering by id beats sweeping all ~9k people.
        const chunk = ids.slice(i, i + ID_CHUNK);
        rows.push(...(await getAll("/People", { Filters: `personId==${chunk.join("|")}` })));
      }
      return rows.map((row) => ({
        personId: Number(row.personId),
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        contactEmail: row.email || null,
      }));
    },
  };
}

// Only the fields we actually read; FACTS returns far more.
type FactsRow = {
  personId?: number;
  studentId?: number;
  staffId?: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  active?: boolean;
  school?: { gradeLevel?: string | null; status?: string | null };
};

type FactsPage = {
  results?: FactsRow[];
  pageCount?: number;
};
