import { factsPerson, factsStaff, factsStudent, syncRun } from "@/lib/db/schema";

import type { TestDb } from "../support/db";

// Every sync suite starts from an empty portal — FACTS snapshot, run log and allowlist.
export async function resetSync(db: TestDb["db"]) {
  await db.delete(factsPerson);
  await db.delete(factsStudent);
  await db.delete(factsStaff);
  await db.delete(syncRun);
}
