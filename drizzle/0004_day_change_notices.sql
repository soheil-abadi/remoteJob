CREATE TABLE IF NOT EXISTS "day_change_notices" (
  "id" serial PRIMARY KEY NOT NULL,
  "week_start" date NOT NULL,
  "person" text NOT NULL,
  "changed_by" text NOT NULL,
  "old_days" jsonb NOT NULL,
  "new_days" jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
