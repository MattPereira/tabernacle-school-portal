import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

console.log("[db] hostname", new URL(connectionString).hostname);

// One pool per Vercel Fluid Compute instance. The pg driver provides the
// interactive transactions sync requires; Vercel drains idle connections
// before suspending the instance.
const pool = new Pool({ connectionString, max: 5 });
attachDatabasePool(pool);

// Wiring module: thin glue over drizzle + Neon. No business logic (ADR-0002 §2).
export const db = drizzle({ client: pool, schema });
