CREATE TYPE "public"."identity_role" AS ENUM('student', 'staff');--> statement-breakpoint
CREATE TABLE "identity_link" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "identity_link_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"google_email" text NOT NULL,
	"facts_person_id" integer,
	"role" "identity_role" NOT NULL,
	"admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "identity_link_google_email_key" ON "identity_link" USING btree ("google_email");