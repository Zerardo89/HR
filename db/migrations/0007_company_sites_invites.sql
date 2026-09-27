CREATE TABLE "company_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email_bidx" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" "member_role" DEFAULT 'recruiter' NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "company_invites_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "company_invites_period" CHECK ("company_invites"."expires_at" > "company_invites"."created_at")
);
--> statement-breakpoint
ALTER TABLE "company_sites" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_sites" ADD COLUMN "rejection_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_invites_company_idx" ON "company_invites" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_invites_open_uq" ON "company_invites" USING btree ("company_id","email_bidx") WHERE "company_invites"."accepted_at" is null and "company_invites"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "company_sites" ADD CONSTRAINT "company_sites_review" CHECK (not ("company_sites"."approved_at" is not null and "company_sites"."rejected_at" is not null) and ("company_sites"."rejected_at" is null) = ("company_sites"."rejection_reason" is null));