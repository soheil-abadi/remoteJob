CREATE TABLE IF NOT EXISTS "swap_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "week_start" date NOT NULL,
  "from_person" text NOT NULL,
  "to_person" text NOT NULL,
  "from_day" text NOT NULL,
  "to_day" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
