CREATE UNIQUE INDEX "sync_run_one_in_flight" ON "sync_run" USING btree ((1)) WHERE "sync_run"."outcome" is null;
