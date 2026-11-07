CREATE TABLE IF NOT EXISTS "schedules" (
  "week_start" date PRIMARY KEY NOT NULL,
  "assignments" jsonb NOT NULL,
  "days_per_person" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
