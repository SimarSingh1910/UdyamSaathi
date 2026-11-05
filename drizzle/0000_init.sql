CREATE TABLE "app_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"business" jsonb NOT NULL,
	"reasons" jsonb NOT NULL,
	"assigned_to" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "lead_actions" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"assigned_to" text,
	"note" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"lang" text NOT NULL,
	"channel" text,
	"business" jsonb NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"lines" jsonb NOT NULL,
	"events" jsonb NOT NULL,
	"monthly_total" double precision NOT NULL,
	"setup_total" double precision NOT NULL,
	"contract_months" integer NOT NULL,
	"expected_activation_days" integer NOT NULL,
	"install_slot" text,
	"engineer" text
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"phone_hash" text NOT NULL,
	"method" text NOT NULL,
	"code_hash" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"wa_session" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"price_min" double precision NOT NULL,
	"price_max" double precision NOT NULL,
	"setup_fee" double precision NOT NULL,
	"min_contract_months" integer NOT NULL,
	"city_tiers" jsonb NOT NULL,
	"min_employees" integer NOT NULL,
	"min_sites" integer NOT NULL,
	"requires_gstin" boolean NOT NULL,
	"requires_one_of" jsonb NOT NULL,
	"install_days" integer NOT NULL,
	"target_segments" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_sessions" (
	"key" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "help_requests_created_at_idx" ON "help_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "phone_verifications_phone_idx" ON "phone_verifications" USING btree ("phone_hash","created_at");