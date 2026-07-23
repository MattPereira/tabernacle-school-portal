import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Proves the in-process Postgres harness runs real SQL — the substrate the
// later sync/identity module tests build on (ADR-0002 §6). No Docker, no network.
describe("pglite harness", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    client = new PGlite();
    db = drizzle(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("runs real SQL in an in-process Postgres", async () => {
    await db.execute(sql`create table t (id int primary key, name text)`);
    await db.execute(sql`insert into t (id, name) values (1, 'ada')`);

    const result = await db.execute(sql`select name from t where id = 1`);

    expect(result.rows[0]).toEqual({ name: "ada" });
  });
});
