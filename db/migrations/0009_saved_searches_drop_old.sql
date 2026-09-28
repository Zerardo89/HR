ALTER TABLE "saved_searches" DROP CONSTRAINT "saved_searches_municipality_code_municipalities_istat_code_fk";
--> statement-breakpoint
ALTER TABLE "saved_searches" ALTER COLUMN "params" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "query";--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "occupation_ids";--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "municipality_code";--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "radius_km";