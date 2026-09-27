ALTER TABLE "occupations" ADD COLUMN "slug" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "occupations" ADD COLUMN "category" varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE "occupations" ADD CONSTRAINT "occupations_slug_unique" UNIQUE("slug");