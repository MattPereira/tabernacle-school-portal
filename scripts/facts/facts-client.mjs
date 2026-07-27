// Shared FACTS API client with rate limiting (10 requests/minute).
// Serializes all requests and spaces them ~6.5s apart; honors 429 Retry-After.

const BASE_URL = "https://api.factsmgt.com";
const MAX_PER_WINDOW = 10; // API allows 10 requests...
const WINDOW_MS = 60_000; // ...per rolling 60s window
const PAD_MS = 2_000; // safety pad so we clear the window edge

const { FACTS_SUBSCRIPTION_KEY, FACTS_API_KEY } = process.env;
if (!FACTS_SUBSCRIPTION_KEY || !FACTS_API_KEY) {
  console.error("Missing FACTS_SUBSCRIPTION_KEY or FACTS_API_KEY. Run with --env-file=.env");
  process.exit(1);
}

const headers = {
  "Ocp-Apim-Subscription-Key": FACTS_SUBSCRIPTION_KEY,
  "Facts-Api-Key": FACTS_API_KEY,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chain = Promise.resolve();
const fireTimes = []; // timestamps of recent requests (sliding window)

// Block until firing now keeps us within MAX_PER_WINDOW over WINDOW_MS.
async function awaitSlot() {
  for (;;) {
    const now = Date.now();
    // Drop timestamps that have aged out of the window.
    while (fireTimes.length && now - fireTimes[0] >= WINDOW_MS) fireTimes.shift();
    if (fireTimes.length < MAX_PER_WINDOW) return;
    // Window full: wait until the oldest request exits it (+pad).
    const wait = WINDOW_MS - (now - fireTimes[0]) + PAD_MS;
    console.warn(`  rate window full (${MAX_PER_WINDOW}/min), waiting ${Math.ceil(wait / 1000)}s...`);
    await sleep(wait);
  }
}

// Queue a rate-limited GET. Returns parsed JSON.
export function apiGet(path, params = {}) {
  const run = async () => {
    await awaitSlot();
    fireTimes.push(Date.now());

    const qs = new URLSearchParams({ "api-version": "1", ...params }).toString();
    const url = `${BASE_URL}${path}?${qs}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        // Shouldn't happen with the sliding window, but back off if the
        // server disagrees about our budget.
        const retry = Number(res.headers.get("retry-after")) || 60;
        console.warn(`  429 rate-limited, waiting ${retry}s...`);
        await sleep(retry * 1000);
        fireTimes.push(Date.now()); // count the rejected attempt
        continue;
      }
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}: ${await res.text()}`);
      return res.json();
    }
    throw new Error(`GET ${url} -> gave up after repeated 429s`);
  };
  chain = chain.then(run, run);
  return chain;
}

// Fetch every page of a paged endpoint, returning the flattened results array.
export async function apiGetAll(path, params = {}, pageSize = 1000) {
  const all = [];
  let page = 1;
  let pageCount = 1;
  do {
    const data = await apiGet(path, { ...params, Page: page, PageSize: pageSize });
    all.push(...(data.results ?? []));
    pageCount = data.pageCount ?? 1;
    console.log(`  ${path} page ${page}/${pageCount} (${all.length}/${data.rowCount ?? "?"})`);
    page++;
  } while (page <= pageCount);
  return all;
}
