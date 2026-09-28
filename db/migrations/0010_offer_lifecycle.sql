ALTER TABLE "job_offers" ADD COLUMN "expiry_notice_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "closure_notified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "applications_closure_pending_idx" ON "applications" USING btree ("closed_at") WHERE "applications"."status" = 'closed' and "applications"."closure_notified_at" is null;--> statement-breakpoint
CREATE INDEX "applications_company_visible_idx" ON "applications" USING btree ("company_visible_until");