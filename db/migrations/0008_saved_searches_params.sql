ALTER TABLE "saved_searches" ADD COLUMN "params" varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "checked_until" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_user_params_uq" ON "saved_searches" USING btree ("user_id","params");--> statement-breakpoint
CREATE INDEX "saved_searches_checked_idx" ON "saved_searches" USING btree ("checked_until");