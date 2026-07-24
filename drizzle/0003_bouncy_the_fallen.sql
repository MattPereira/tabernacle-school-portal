ALTER TABLE "sync_run" ALTER COLUMN "finished_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_run" ALTER COLUMN "outcome" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mirror_person" ADD COLUMN "flagged_by_run_id" integer;--> statement-breakpoint
ALTER TABLE "mirror_staff" ADD COLUMN "flagged_by_run_id" integer;--> statement-breakpoint
ALTER TABLE "mirror_student" ADD COLUMN "flagged_by_run_id" integer;