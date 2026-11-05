CREATE TABLE "hidden_leads" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"hidden_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	"contact_phone" text
);
--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");