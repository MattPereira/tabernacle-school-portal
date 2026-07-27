import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("derived-identity migration", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = new PGlite();
    await client.exec(`
      create type identity_role as enum ('student', 'staff');
      create table identity_link (id integer primary key, role identity_role not null);
      create table facts_person (person_id integer primary key, flagged_by_run_id integer);
      create table facts_student (student_id integer primary key, flagged_by_run_id integer);
      create table facts_staff (staff_id integer primary key, flagged_by_run_id integer);
      create table sync_run (id integer primary key, outcome text, finished_at timestamptz, unlinked_count integer not null default 0);
      create table "user" (id text primary key);
      create table session (id text primary key);
    `);
  });

  afterAll(async () => { await client.close(); });

  it("drops portal identity objects and retired metadata while preserving auth and run lifecycle", async () => {
    await client.exec(await readFile("drizzle/0005_derive_facts_identity.sql", "utf8"));

    await expect(client.query("select * from identity_link")).rejects.toThrow();
    await expect(client.query("select * from identity_role")).rejects.toThrow();
    await expect(client.query("select flagged_by_run_id from facts_person")).rejects.toThrow();
    await expect(client.query("select unlinked_count from sync_run")).rejects.toThrow();
    await expect(client.query("select outcome, finished_at from sync_run")).resolves.toBeDefined();
    await expect(client.query('select * from "user"')).resolves.toBeDefined();
    await expect(client.query("select * from session")).resolves.toBeDefined();
  });
});
