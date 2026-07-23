import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Wiring module: thin glue over drizzle + Neon. No business logic (ADR-0002 §2).
export const db = drizzle(neon(connectionString), { schema });
