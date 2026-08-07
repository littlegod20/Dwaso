CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('GHS', 'NGN', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."shop_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."supplier_source" AS ENUM('manual', 'google_places', 'self_listed');--> statement-breakpoint
CREATE TYPE "public"."barcode_format" AS ENUM('ean13', 'ean8', 'upca', 'upce', 'code128', 'qr', 'other');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_reason" AS ENUM('restock', 'sale', 'sale_reversal', 'adjustment', 'reconciliation', 'opening_balance');--> statement-breakpoint
CREATE TYPE "public"."creditor_source" AS ENUM('manual', 'contact_import');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_kind" AS ENUM('credit_sale', 'payment', 'adjustment', 'write_off');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'credit', 'mobile_money', 'bank');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('whatsapp', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('pending', 'sending', 'sent', 'delivered', 'failed', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."scan_tier" AS ENUM('barcode', 'embedding', 'vision', 'manual');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"platform" "device_platform" DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shop_members" (
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "shop_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_members_shop_id_user_id_pk" PRIMARY KEY("shop_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" "currency" DEFAULT 'GHS' NOT NULL,
	"timezone" text DEFAULT 'Africa/Accra' NOT NULL,
	"country_code" text DEFAULT 'GH' NOT NULL,
	"low_stock_threshold_default" integer DEFAULT 5 NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"category" text,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"source" "supplier_source" DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "price_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"from_cost_minor" bigint,
	"to_cost_minor" bigint,
	"from_sell_minor" bigint,
	"to_sell_minor" bigint,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "product_barcodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"barcode" text NOT NULL,
	"format" "barcode_format" DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"sku" text,
	"unit" text DEFAULT 'unit' NOT NULL,
	"cost_price_minor" bigint DEFAULT 0 NOT NULL,
	"sell_price_minor" bigint DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"is_loose_good" boolean DEFAULT false NOT NULL,
	"default_supplier_id" uuid,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "stock_movement_reason" NOT NULL,
	"unit_cost_minor" bigint,
	"supplier_id" uuid,
	"sale_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"creditor_id" uuid NOT NULL,
	"kind" "ledger_entry_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"sale_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "creditors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"due_date" date,
	"note" text,
	"reminders_opted_out" boolean DEFAULT false NOT NULL,
	"source" "creditor_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"creditor_id" uuid,
	"total_minor" bigint NOT NULL,
	"cost_total_minor" bigint NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "creditor_balances" (
	"shop_id" uuid NOT NULL,
	"creditor_id" uuid NOT NULL,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"last_payment_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creditor_balances_shop_id_creditor_id_pk" PRIMARY KEY("shop_id","creditor_id")
);
--> statement-breakpoint
CREATE TABLE "daily_shop_metrics" (
	"shop_id" uuid NOT NULL,
	"date" date NOT NULL,
	"revenue_minor" bigint DEFAULT 0 NOT NULL,
	"cost_minor" bigint DEFAULT 0 NOT NULL,
	"profit_minor" bigint DEFAULT 0 NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_shop_metrics_shop_id_date_pk" PRIMARY KEY("shop_id","date")
);
--> statement-breakpoint
CREATE TABLE "product_stock" (
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_stock_shop_id_product_id_pk" PRIMARY KEY("shop_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "message_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"creditor_id" uuid NOT NULL,
	"channel" "message_channel" NOT NULL,
	"recipient" text NOT NULL,
	"body" text NOT NULL,
	"status" "message_status" DEFAULT 'pending' NOT NULL,
	"dedupe_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"creditor_id" uuid,
	"channel" "message_channel" DEFAULT 'whatsapp' NOT NULL,
	"rules" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_seq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_device_id" uuid
);
--> statement-breakpoint
CREATE TABLE "low_stock_alerts" (
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"alerted_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "low_stock_alerts_shop_id_product_id_alerted_on_pk" PRIMARY KEY("shop_id","product_id","alerted_on")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" DEFAULT 'unknown' NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barcode_catalog" (
	"barcode" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"confirmations" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_embeddings" (
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"embedding" vector(512) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_embeddings_shop_id_product_id_pk" PRIMARY KEY("shop_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"tier" "scan_tier" NOT NULL,
	"matched_product_id" uuid,
	"confidence" real,
	"latency_ms" integer,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"image_hash" text,
	"resolved_later" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_quota_usage" (
	"shop_id" uuid NOT NULL,
	"date" date NOT NULL,
	"vision_calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "scan_quota_usage_shop_id_date_pk" PRIMARY KEY("shop_id","date")
);
--> statement-breakpoint
CREATE TABLE "sync_device_state" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"last_pulled_seq" bigint DEFAULT 0 NOT NULL,
	"last_pushed_at" timestamp with time zone,
	"last_pulled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_mutations" (
	"mutation_id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"op" text NOT NULL,
	"server_seq" bigint,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid,
	"device_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_default_supplier_id_suppliers_id_fk" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_creditor_id_creditors_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."creditors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creditors" ADD CONSTRAINT "creditors_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_creditor_id_creditors_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."creditors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creditor_balances" ADD CONSTRAINT "creditor_balances_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creditor_balances" ADD CONSTRAINT "creditor_balances_creditor_id_creditors_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."creditors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_shop_metrics" ADD CONSTRAINT "daily_shop_metrics_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_creditor_id_creditors_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."creditors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_creditor_id_creditors_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."creditors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_matched_product_id_products_id_fk" FOREIGN KEY ("matched_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_quota_usage" ADD CONSTRAINT "scan_quota_usage_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_device_state" ADD CONSTRAINT "sync_device_state_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_mutations" ADD CONSTRAINT "sync_mutations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_key" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_device_idx" ON "refresh_tokens" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "shop_members_user_idx" ON "shop_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "suppliers_shop_seq_idx" ON "suppliers" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "suppliers_shop_category_idx" ON "suppliers" USING btree ("shop_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_shop_external_key" ON "suppliers" USING btree ("shop_id","external_id") WHERE "suppliers"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "price_changes_shop_seq_idx" ON "price_changes" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "price_changes_product_idx" ON "price_changes" USING btree ("shop_id","product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "product_barcodes_shop_seq_idx" ON "product_barcodes" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "product_barcodes_product_idx" ON "product_barcodes" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_barcodes_shop_code_key" ON "product_barcodes" USING btree ("shop_id","barcode") WHERE "product_barcodes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_shop_seq_idx" ON "products" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "products_shop_name_idx" ON "products" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_shop_sku_key" ON "products" USING btree ("shop_id","sku") WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_movements_shop_seq_idx" ON "stock_movements" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("shop_id","product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "stock_movements_shop_occurred_idx" ON "stock_movements" USING btree ("shop_id","occurred_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_shop_seq_idx" ON "credit_ledger_entries" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "credit_ledger_creditor_idx" ON "credit_ledger_entries" USING btree ("shop_id","creditor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "creditors_shop_seq_idx" ON "creditors" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "creditors_shop_due_idx" ON "creditors" USING btree ("shop_id","due_date");--> statement-breakpoint
CREATE INDEX "sale_items_shop_seq_idx" ON "sale_items" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_idx" ON "sale_items" USING btree ("shop_id","product_id");--> statement-breakpoint
CREATE INDEX "sales_shop_seq_idx" ON "sales" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "sales_shop_occurred_idx" ON "sales" USING btree ("shop_id","occurred_at");--> statement-breakpoint
CREATE INDEX "sales_creditor_idx" ON "sales" USING btree ("shop_id","creditor_id");--> statement-breakpoint
CREATE INDEX "creditor_balances_shop_balance_idx" ON "creditor_balances" USING btree ("shop_id","balance_minor");--> statement-breakpoint
CREATE INDEX "product_stock_shop_qty_idx" ON "product_stock" USING btree ("shop_id","quantity");--> statement-breakpoint
CREATE UNIQUE INDEX "message_outbox_dedupe_key" ON "message_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "message_outbox_pending_idx" ON "message_outbox" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "message_outbox_creditor_idx" ON "message_outbox" USING btree ("shop_id","creditor_id","created_at");--> statement-breakpoint
CREATE INDEX "reminder_schedules_shop_seq_idx" ON "reminder_schedules" USING btree ("shop_id","server_seq");--> statement-breakpoint
CREATE INDEX "reminder_schedules_creditor_idx" ON "reminder_schedules" USING btree ("shop_id","creditor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "push_tokens_shop_idx" ON "push_tokens" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "barcode_catalog_name_idx" ON "barcode_catalog" USING btree ("name");--> statement-breakpoint
CREATE INDEX "product_embeddings_vector_idx" ON "product_embeddings" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_shop_hash_key" ON "product_images" USING btree ("shop_id","content_hash");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("shop_id","product_id");--> statement-breakpoint
CREATE INDEX "scan_events_shop_created_idx" ON "scan_events" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "scan_events_tier_idx" ON "scan_events" USING btree ("shop_id","tier","created_at");--> statement-breakpoint
CREATE INDEX "sync_device_state_shop_idx" ON "sync_device_state" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "sync_mutations_shop_applied_idx" ON "sync_mutations" USING btree ("shop_id","applied_at");--> statement-breakpoint
CREATE INDEX "sync_mutations_entity_idx" ON "sync_mutations" USING btree ("shop_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_shop_created_idx" ON "audit_log" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("shop_id","entity","entity_id");