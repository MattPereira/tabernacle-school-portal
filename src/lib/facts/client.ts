import { createFactsClient, type FactsClient } from "./index";

// Wiring: env -> the configured client sync takes as a dependency. Built on
// demand rather than at module load, so a deployment missing the FACTS keys
// still serves login and the holding page — only the sync button fails, and it
// fails saying why.
export function factsClient(): FactsClient {
  const subscriptionKey = process.env.SUBSCRIPTION_KEY;
  const apiKey = process.env.FACTS_API_KEY;

  if (!subscriptionKey || !apiKey) {
    throw new Error("FACTS credentials are not set (SUBSCRIPTION_KEY, FACTS_API_KEY)");
  }

  return createFactsClient({ subscriptionKey, apiKey });
}
