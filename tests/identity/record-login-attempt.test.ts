import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { identityLink } from "@/lib/db/schema";
import { recordLoginAttempt } from "@/lib/identity";

import { createTestDb, type TestDb } from "../support/db";

describe("recordLoginAttempt", () => {
  let harness: TestDb;
  let db: TestDb["db"];
  let warnings: string[];
  const log = { warn: (message: string) => warnings.push(message) };

  beforeAll(async () => {
    harness = await createTestDb();
    db = harness.db;
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    warnings = [];
    await db.delete(identityLink);
  });

  it("logs an unlinked login so the office can follow it up", async () => {
    // The only record of an unlinked login — there is no UI and no
    // request-access flow (CONTEXT.md, holding page).
    const access = await recordLoginAttempt("office@tbs.org", { db, log });

    expect(access).toEqual({ linked: false });
    expect(warnings).toEqual([expect.stringContaining("office@tbs.org")]);
  });

  it("stays quiet for a linked login", async () => {
    await db.insert(identityLink).values({
      googleEmail: "27beno@tbs.org",
      factsPersonId: 1206161,
      role: "student",
    });

    const access = await recordLoginAttempt("27BenO@tbs.org", { db, log });

    expect(access).toMatchObject({ linked: true, role: "student" });
    expect(warnings).toEqual([]);
  });
});
