-- Row-level security as defence in depth behind the repository layer.
--
-- The application already scopes every query by shop_id through TenantContext.
-- These policies exist for the case that layer is ever bypassed: a query that
-- forgets its shop filter returns nothing rather than another trader's ledger.
--
-- The API connects as a non-superuser role and sets `app.shop_id` for the
-- duration of each transaction. `current_setting(..., true)` returns NULL rather
-- than erroring when unset, and a NULL comparison yields no rows, so an
-- unscoped connection is fenced off by default.

CREATE OR REPLACE FUNCTION app_current_shop_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.shop_id', true), '')::uuid;
$$;
--> statement-breakpoint

DO $$
DECLARE
  target_table text;
  tenant_tables text[] := ARRAY[
    'products',
    'product_barcodes',
    'price_changes',
    'stock_movements',
    'sales',
    'sale_items',
    'creditors',
    'credit_ledger_entries',
    'suppliers',
    'reminder_schedules',
    'message_outbox',
    'product_stock',
    'creditor_balances',
    'daily_shop_metrics',
    'push_tokens',
    'low_stock_alerts',
    'product_images',
    'product_embeddings',
    'scan_events',
    'scan_quota_usage',
    'sync_mutations',
    'sync_device_state',
    'audit_log'
  ];
BEGIN
  FOREACH target_table IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);

    -- FORCE applies the policy to the table owner too. Without it the role that
    -- runs migrations would silently bypass every policy below.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', target_table || '_tenant_isolation', target_table);

    EXECUTE format(
      'CREATE POLICY %I ON %I USING (shop_id = app_current_shop_id()) WITH CHECK (shop_id = app_current_shop_id())',
      target_table || '_tenant_isolation',
      target_table
    );
  END LOOP;
END $$;
--> statement-breakpoint

-- The role the API connects as in production.
--
-- Deliberately not the table owner and not a superuser, because both bypass RLS
-- and would make every policy above decorative. There is intentionally no
-- bypass role: background workers enumerate shops from `shops` (which is not
-- RLS-protected, since it is the tenant list itself) and then scope each unit of
-- work to one shop, so even a sweep that touches every trader does so one
-- tenant at a time under the same policies as a request.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dwaso_app') THEN
    CREATE ROLE dwaso_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO dwaso_app;
--> statement-breakpoint

DO $$
DECLARE
  target_table text;
BEGIN
  FOR target_table IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO dwaso_app', target_table);
  END LOOP;
END $$;
--> statement-breakpoint

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dwaso_app;
