DROP TABLE "identity_link";--> statement-breakpoint
DROP TYPE "identity_role";--> statement-breakpoint
ALTER TABLE "facts_person" DROP COLUMN "flagged_by_run_id";--> statement-breakpoint
ALTER TABLE "facts_student" DROP COLUMN "flagged_by_run_id";--> statement-breakpoint
ALTER TABLE "facts_staff" DROP COLUMN "flagged_by_run_id";--> statement-breakpoint
ALTER TABLE "sync_run" DROP COLUMN "unlinked_count";
