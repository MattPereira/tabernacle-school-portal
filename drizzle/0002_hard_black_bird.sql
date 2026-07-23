CREATE TYPE "public"."sync_outcome" AS ENUM('applied', 'failed');--> statement-breakpoint
CREATE TABLE "mirror_person" (
	"person_id" integer PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"contact_email" text,
	"inactive" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_staff" (
	"staff_id" integer PRIMARY KEY NOT NULL,
	"inactive" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_student" (
	"student_id" integer PRIMARY KEY NOT NULL,
	"grade_level" text,
	"status" text,
	"inactive" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"outcome" "sync_outcome" NOT NULL,
	"people_count" integer DEFAULT 0 NOT NULL,
	"student_count" integer DEFAULT 0 NOT NULL,
	"staff_count" integer DEFAULT 0 NOT NULL,
	"flagged_count" integer DEFAULT 0 NOT NULL,
	"unlinked_count" integer DEFAULT 0 NOT NULL,
	"detail" text
);
