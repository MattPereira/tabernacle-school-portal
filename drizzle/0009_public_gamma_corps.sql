CREATE TABLE "facts_grade_level" (
	"grade_level" text PRIMARY KEY NOT NULL,
	"sort_order" integer,
	"inactive" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facts_person" ADD COLUMN "birthdate" date;--> statement-breakpoint
ALTER TABLE "facts_student" ADD COLUMN "enrolled_since" date;--> statement-breakpoint
ALTER TABLE "facts_student" ADD COLUMN "homeroom" text;--> statement-breakpoint
ALTER TABLE "facts_student" ADD COLUMN "room" text;--> statement-breakpoint
ALTER TABLE "facts_student" ADD COLUMN "homeroom_staff_id" integer;