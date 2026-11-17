CREATE TABLE IF NOT EXISTS "person_pins" (
  "person" text PRIMARY KEY NOT NULL,
  "pin" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
