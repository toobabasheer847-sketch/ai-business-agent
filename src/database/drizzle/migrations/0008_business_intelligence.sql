CREATE TABLE IF NOT EXISTS "business_forecasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "metric_key" varchar(80) NOT NULL,
  "forecast_method" varchar(40) NOT NULL,
  "historical_period_start" timestamp with time zone NOT NULL,
  "historical_period_end" timestamp with time zone NOT NULL,
  "forecast_period_start" timestamp with time zone NOT NULL,
  "forecast_period_end" timestamp with time zone NOT NULL,
  "predicted_value" numeric(18, 4),
  "lower_bound" numeric(18, 4),
  "upper_bound" numeric(18, 4),
  "confidence_level" varchar(30) NOT NULL,
  "model_metadata" jsonb NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "predictive_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "insight_key" varchar(160) NOT NULL,
  "category" varchar(40) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(800) NOT NULL,
  "evidence" varchar(800) NOT NULL,
  "confidence_level" varchar(30) NOT NULL,
  "recommendation" varchar(400) NOT NULL,
  "status" varchar(20) NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "forecast_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "forecast_id" uuid NOT NULL,
  "actual_value" numeric(18, 4),
  "absolute_error" numeric(18, 4),
  "percentage_error" numeric(8, 2),
  "evaluation_kind" varchar(40) NOT NULL,
  "evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "business_forecasts" ADD CONSTRAINT "business_forecasts_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "predictive_insights" ADD CONSTRAINT "predictive_insights_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "forecast_evaluations" ADD CONSTRAINT "forecast_evaluations_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "forecast_evaluations" ADD CONSTRAINT "forecast_evaluations_forecast_id_fk"
    FOREIGN KEY ("forecast_id") REFERENCES "business_forecasts"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "predictive_insights" ADD CONSTRAINT "predictive_insights_status_check"
    CHECK ("status" IN ('open', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "business_forecasts" ADD CONSTRAINT "business_forecasts_confidence_check"
    CHECK ("confidence_level" IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "business_forecasts_window_unique"
  ON "business_forecasts" ("tenant_id", "metric_key", "historical_period_start", "historical_period_end", "forecast_period_end", "forecast_method");
CREATE INDEX IF NOT EXISTS "business_forecasts_tenant_idx"
  ON "business_forecasts" ("tenant_id", "generated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "predictive_insights_key_unique"
  ON "predictive_insights" ("tenant_id", "insight_key");
CREATE INDEX IF NOT EXISTS "predictive_insights_tenant_idx"
  ON "predictive_insights" ("tenant_id", "generated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "forecast_evaluations_forecast_unique"
  ON "forecast_evaluations" ("forecast_id");
CREATE INDEX IF NOT EXISTS "forecast_evaluations_tenant_idx"
  ON "forecast_evaluations" ("tenant_id", "evaluated_at");
