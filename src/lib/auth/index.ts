import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { SCHOOL_DOMAIN } from "@/lib/identity";

// Wiring module: thin glue configuring better-auth. No business logic — the
// gate is resolveAccess, not this file (ADR-0002 §2).
export const auth = betterAuth({
  // Transactions are off because Neon's HTTP driver has none; better-auth's
  // operations run sequentially, which is what the adapter defaults to anyway.
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: false }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Sent as the `hd` authorization hint AND enforced by better-auth against
      // the id token's verified `hd` claim. getViewer re-checks it anyway — the
      // domain is a policy layered over the link-table gate (ADR-0001,
      // Decision 4), and neither layer is trusted to be the only one.
      hd: SCHOOL_DOMAIN,
    },
  },
  plugins: [nextCookies()],
});
