import { identityLink, mirrorPerson, mirrorStaff, mirrorStudent, syncRun } from "@/lib/db/schema";

import type { TestDb } from "../support/db";

// Every sync suite starts from an empty portal — mirror, run log and allowlist.
export async function resetSync(db: TestDb["db"]) {
  await db.delete(mirrorPerson);
  await db.delete(mirrorStudent);
  await db.delete(mirrorStaff);
  await db.delete(syncRun);
  await db.delete(identityLink);
}
