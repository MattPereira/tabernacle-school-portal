import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/lib/db/schema";

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

// A real in-process Postgres with the project's migrations applied — the
// substrate every deep-module test runs on (ADR-0002 §6). No Docker, no
// network. Running the same drizzle/ SQL the deployed database gets means a
// migration that would fail in production fails here first.
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "./drizzle" });

  return {
    db,
    close: () => client.close(),
  };
}
