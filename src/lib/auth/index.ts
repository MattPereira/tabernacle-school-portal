import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { user } from "@/lib/db/schema";
import { recordLoginAttempt, SCHOOL_DOMAIN } from "@/lib/identity";

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
  databaseHooks: {
    session: {
      create: {
        // Hooked on session creation so the log fires once per login rather
        // than once per page view. `user.create.before` would hand us the email
        // directly but only fires on a first-ever login, so returning unlinked
        // users would never be logged — hence the extra lookup.
        //
        // Everything here is best-effort: a login must never fail because a log
        // line couldn't be written.
        after: async (createdSession) => {
          try {
            const [account] = await db
              .select({ email: user.email })
              .from(user)
              .where(eq(user.id, createdSession.userId))
              .limit(1);
            if (!account) return;

            await recordLoginAttempt(account.email, { db, log: console });
          } catch (error) {
            console.error("[auth] could not record login attempt", error);
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});
