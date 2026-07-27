import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("FACTS snapshot rename migration", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = new PGlite();
    await client.exec(`
      create table mirror_person (person_id integer primary key, first_name text);
      create table mirror_student (student_id integer primary key);
      create table mirror_staff (staff_id integer primary key);
      insert into mirror_person values (1203006, 'Jane');
      insert into mirror_student values (1206161);
      insert into mirror_staff values (1203006);
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it("preserves existing rows while renaming all snapshot tables", async () => {
    const migration = await readFile("drizzle/0004_rename_facts_snapshot.sql", "utf8");

    await client.exec(migration);

    await expect(client.query("select * from facts_person")).resolves.toMatchObject({
      rows: [{ person_id: 1203006, first_name: "Jane" }],
    });
    await expect(client.query("select * from facts_student")).resolves.toMatchObject({
      rows: [{ student_id: 1206161 }],
    });
    await expect(client.query("select * from facts_staff")).resolves.toMatchObject({
      rows: [{ staff_id: 1203006 }],
    });
  });
});
