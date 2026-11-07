ALTER TABLE "schedules"
ADD COLUMN IF NOT EXISTS "days_per_person" integer DEFAULT 1 NOT NULL;
