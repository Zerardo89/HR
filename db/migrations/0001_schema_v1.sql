CREATE TYPE "public"."ad_slot" AS ENUM('home_sponsor', 'results_native', 'offer_training', 'offer_bottom');--> statement-breakpoint
CREATE TYPE "public"."alert_frequency" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('sent', 'viewed', 'in_review', 'contacted', 'rejected', 'hired', 'withdrawn', 'closed');--> statement-breakpoint
CREATE TYPE "public"."company_kind" AS ENUM('employer', 'agency');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('pending', 'verified', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('privacy_notice', 'terms', 'monthly_check', 'job_alerts', 'marketing', 'l68_health', 'waitlist_launch');--> statement-breakpoint
CREATE TYPE "public"."contact_request_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('permanent', 'fixed_term', 'apprenticeship', 'agency', 'internship', 'seasonal', 'collaboration', 'self_employed', 'occasional');--> statement-breakpoint
CREATE TYPE "public"."email_action" AS ENUM('monthly_seeking', 'monthly_open', 'monthly_hide', 'monthly_delete', 'waitlist_confirm', 'unsubscribe');--> statement-breakpoint
CREATE TYPE "public"."entitlement_owner" AS ENUM('company', 'user');--> statement-breakpoint
CREATE TYPE "public"."entitlement_product" AS ENUM('supporter', 'national', 'featured');--> statement-breakpoint
CREATE TYPE "public"."entitlement_source" AS ENUM('stripe', 'crowdfunding', 'promo', 'founders');--> statement-breakpoint
CREATE TYPE "public"."experience_band" AS ENUM('none', 'lt1', 'y1_3', 'y3_5', 'y5_10', 'gt10');--> statement-breakpoint
CREATE TYPE "public"."language_level" AS ENUM('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'recruiter');--> statement-breakpoint
CREATE TYPE "public"."offer_scope" AS ENUM('local', 'national');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'pending_review', 'published', 'expired', 'closed', 'removed');--> statement-breakpoint
CREATE TYPE "public"."remote_mode" AS ENUM('on_site', 'hybrid', 'remote');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('scam', 'discriminatory', 'illegal', 'misleading', 'payment_requested', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('offer', 'company');--> statement-breakpoint
CREATE TYPE "public"."salary_basis" AS ENUM('gross', 'net');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('hour', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."schedule_type" AS ENUM('full_time', 'part_time', 'shifts', 'weekends', 'flexible');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('worker', 'company_member', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."waitlist_kind" AS ENUM('worker', 'company');--> statement-breakpoint
CREATE TYPE "public"."worker_state" AS ENUM('seeking', 'open', 'hidden');--> statement-breakpoint
CREATE TABLE "municipalities" (
	"istat_code" char(6) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"province_code" char(3) NOT NULL,
	"region_code" char(2) NOT NULL,
	"population" integer,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"centroid" "geography" GENERATED ALWAYS AS ((ST_SetSRID(ST_MakePoint(lon, lat), 4326))::geography) STORED
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" serial PRIMARY KEY NOT NULL,
	"esco_uri" text,
	"isco_code" varchar(4),
	"cp2021_code" varchar(16),
	"label_it" text NOT NULL,
	"synonyms" text[] DEFAULT '{}'::text[] NOT NULL,
	"group_code" varchar(4),
	CONSTRAINT "occupations_esco_uri_unique" UNIQUE("esco_uri")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" char(2) NOT NULL,
	"region_code" char(2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regional_internship_minimums" (
	"region_code" char(2) NOT NULL,
	"valid_from" date NOT NULL,
	"monthly_min_eur" numeric(8, 2) NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "regional_internship_minimums_region_code_valid_from_pk" PRIMARY KEY("region_code","valid_from")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"esco_uri" text,
	"label_it" text NOT NULL,
	CONSTRAINT "skills_esco_uri_unique" UNIQUE("esco_uri")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_table" varchar(64),
	"target_id" text,
	"purpose" varchar(64),
	"ip_hash" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"waitlist_id" uuid,
	"type" "consent_type" NOT NULL,
	"version" varchar(32) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_action_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"waitlist_id" uuid,
	"action" "email_action" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"email_bidx" text NOT NULL,
	"email_enc" text NOT NULL,
	"dek_wrapped" text,
	"key_version" integer NOT NULL,
	"adult_declared_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_bidx_unique" UNIQUE("email_bidx")
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_bidx" text NOT NULL,
	"email_enc" text NOT NULL,
	"dek_wrapped" text,
	"key_version" integer NOT NULL,
	"kind" "waitlist_kind" NOT NULL,
	"province_code" char(3),
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_bidx_unique" UNIQUE("email_bidx")
);
--> statement-breakpoint
CREATE TABLE "profile_languages" (
	"user_id" uuid NOT NULL,
	"language_code" varchar(3) NOT NULL,
	"level" "language_level" NOT NULL,
	CONSTRAINT "profile_languages_user_id_language_code_pk" PRIMARY KEY("user_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "profile_occupations" (
	"user_id" uuid NOT NULL,
	"occupation_id" integer NOT NULL,
	"years" smallint,
	CONSTRAINT "profile_occupations_user_id_occupation_id_pk" PRIMARY KEY("user_id","occupation_id")
);
--> statement-breakpoint
CREATE TABLE "profile_skills" (
	"user_id" uuid NOT NULL,
	"skill_id" integer NOT NULL,
	CONSTRAINT "profile_skills_user_id_skill_id_pk" PRIMARY KEY("user_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text,
	"occupation_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"municipality_code" char(6),
	"radius_km" smallint DEFAULT 25 NOT NULL,
	"frequency" "alert_frequency" DEFAULT 'weekly' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"state" "worker_state" DEFAULT 'seeking' NOT NULL,
	"municipality_code" char(6) NOT NULL,
	"radius_km" smallint DEFAULT 25 NOT NULL,
	"relocation_region_codes" char(2)[] DEFAULT '{}'::char(2)[] NOT NULL,
	"experience_band" "experience_band" DEFAULT 'none' NOT NULL,
	"available_from" date,
	"contract_prefs" "contract_type"[] DEFAULT '{}' NOT NULL,
	"schedule_prefs" "schedule_type"[] DEFAULT '{}' NOT NULL,
	"driving_licenses" varchar(8)[] DEFAULT '{}'::varchar(8)[] NOT NULL,
	"pii_enc" text,
	"l68_enc" text,
	"monthly_check_opt_in" boolean DEFAULT false NOT NULL,
	"next_check_at" timestamp with time zone,
	"unanswered_checks" smallint DEFAULT 0 NOT NULL,
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_profiles_radius_range" CHECK ("worker_profiles"."radius_km" between 5 and 200),
	CONSTRAINT "worker_profiles_unanswered_range" CHECK ("worker_profiles"."unanswered_checks" between 0 and 12)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vat_number" char(11) NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" "company_kind" DEFAULT 'employer' NOT NULL,
	"agency_authorization" varchar(64),
	"status" "company_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_vat_number_unique" UNIQUE("vat_number"),
	CONSTRAINT "companies_vat_digits" CHECK ("companies"."vat_number" ~ '^[0-9]{11}$'),
	CONSTRAINT "companies_agency_authorization" CHECK ("companies"."kind" <> 'agency' or "companies"."agency_authorization" is not null)
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_company_id_user_id_pk" PRIMARY KEY("company_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "company_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"municipality_code" char(6) NOT NULL,
	"label" text NOT NULL,
	"is_legal_seat" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_company_blocks" (
	"worker_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_company_blocks_worker_user_id_company_id_pk" PRIMARY KEY("worker_user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid,
	"title" varchar(120) NOT NULL,
	"occupation_id" integer NOT NULL,
	"description_md" text NOT NULL,
	"municipality_code" char(6) NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"schedule" "schedule_type" NOT NULL,
	"hours_per_week" smallint,
	"salary_min" numeric(10, 2),
	"salary_max" numeric(10, 2),
	"salary_period" "salary_period",
	"salary_basis" "salary_basis" DEFAULT 'gross' NOT NULL,
	"ccnl" text,
	"remote_mode" "remote_mode" DEFAULT 'on_site' NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_l68" boolean DEFAULT false NOT NULL,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"scope" "offer_scope" DEFAULT 'local' NOT NULL,
	"published_at" timestamp with time zone,
	"valid_through" timestamp with time zone,
	"featured_until" timestamp with time zone,
	"moderation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('italian_unaccent', coalesce(title, '')), 'A') || setweight(to_tsvector('italian_unaccent', coalesce(description_md, '')), 'C')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_offers_salary_required" CHECK ("job_offers"."status" = 'draft' or "job_offers"."contract_type" in ('collaboration', 'self_employed', 'occasional') or ("job_offers"."salary_min" is not null and "job_offers"."salary_period" is not null)),
	CONSTRAINT "job_offers_salary_range" CHECK ("job_offers"."salary_min" is null or ("job_offers"."salary_min" > 0 and ("job_offers"."salary_max" is null or "job_offers"."salary_max" >= "job_offers"."salary_min"))),
	CONSTRAINT "job_offers_valid_through" CHECK ("job_offers"."status" <> 'published' or ("job_offers"."published_at" is not null and "job_offers"."valid_through" is not null and "job_offers"."valid_through" <= "job_offers"."published_at" + interval '60 days')),
	CONSTRAINT "job_offers_hours_range" CHECK ("job_offers"."hours_per_week" is null or "job_offers"."hours_per_week" between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"worker_user_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'sent' NOT NULL,
	"message_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"company_visible_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"worker_user_id" uuid NOT NULL,
	"offer_id" uuid,
	"status" "contact_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ad_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot" "ad_slot" NOT NULL,
	"advertiser" text NOT NULL,
	"creative" jsonb NOT NULL,
	"geo_scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "entitlement_owner" NOT NULL,
	"owner_id" uuid NOT NULL,
	"product" "entitlement_product" NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"source" "entitlement_source" NOT NULL,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlements_external_ref_unique" UNIQUE("external_ref"),
	CONSTRAINT "entitlements_period" CHECK ("entitlements"."valid_to" is null or "entitlements"."valid_to" > "entitlements"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" varchar(1000),
	"reporter_user_id" uuid,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"decision" text,
	"statement_of_reasons" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "reports_decision_motivated" CHECK ("reports"."status" <> 'actioned' or "reports"."statement_of_reasons" is not null)
);
--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_province_code_provinces_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."provinces"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_internship_minimums" ADD CONSTRAINT "regional_internship_minimums_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_waitlist_id_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_action_tokens" ADD CONSTRAINT "email_action_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_action_tokens" ADD CONSTRAINT "email_action_tokens_waitlist_id_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_province_code_provinces_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."provinces"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_user_id_worker_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."worker_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_occupations" ADD CONSTRAINT "profile_occupations_user_id_worker_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."worker_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_occupations" ADD CONSTRAINT "profile_occupations_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_user_id_worker_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."worker_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_municipality_code_municipalities_istat_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("istat_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_municipality_code_municipalities_istat_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("istat_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_sites" ADD CONSTRAINT "company_sites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_sites" ADD CONSTRAINT "company_sites_municipality_code_municipalities_istat_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("istat_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_company_blocks" ADD CONSTRAINT "worker_company_blocks_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_company_blocks" ADD CONSTRAINT "worker_company_blocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_site_id_company_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."company_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_municipality_code_municipalities_istat_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("istat_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_offer_id_job_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_offer_id_job_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "municipalities_centroid_gist" ON "municipalities" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "municipalities_name_trgm" ON "municipalities" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "municipalities_region_idx" ON "municipalities" USING btree ("region_code");--> statement-breakpoint
CREATE INDEX "occupations_label_trgm" ON "occupations" USING gin ("label_it" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_action_tokens_expires_idx" ON "email_action_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "profile_occupations_occ_idx" ON "profile_occupations" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "worker_profiles_state_idx" ON "worker_profiles" USING btree ("state");--> statement-breakpoint
CREATE INDEX "worker_profiles_municipality_idx" ON "worker_profiles" USING btree ("municipality_code");--> statement-breakpoint
CREATE INDEX "worker_profiles_next_check_idx" ON "worker_profiles" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "company_members_user_idx" ON "company_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "company_sites_company_idx" ON "company_sites" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_offers_search_gin" ON "job_offers" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "job_offers_title_trgm" ON "job_offers" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "job_offers_status_idx" ON "job_offers" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "job_offers_company_idx" ON "job_offers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_offers_occupation_idx" ON "job_offers" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "job_offers_municipality_idx" ON "job_offers" USING btree ("municipality_code");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_offer_worker_uq" ON "applications" USING btree ("offer_id","worker_user_id");--> statement-breakpoint
CREATE INDEX "applications_worker_idx" ON "applications" USING btree ("worker_user_id");--> statement-breakpoint
CREATE INDEX "contact_requests_worker_idx" ON "contact_requests" USING btree ("worker_user_id","status");--> statement-breakpoint
CREATE INDEX "contact_requests_company_idx" ON "contact_requests" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "entitlements_owner_idx" ON "entitlements" USING btree ("owner_type","owner_id","product");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");