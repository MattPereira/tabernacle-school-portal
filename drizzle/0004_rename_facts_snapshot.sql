-- Rename in place so existing FACTS snapshot rows survive.
ALTER TABLE "mirror_person" RENAME TO "facts_person";--> statement-breakpoint
ALTER TABLE "mirror_staff" RENAME TO "facts_staff";--> statement-breakpoint
ALTER TABLE "mirror_student" RENAME TO "facts_student";
