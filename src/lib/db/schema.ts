import { date, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import type { Assignments, DaysPerPerson } from "../people";

export const schedules = pgTable("schedules", {
  weekStart: date("week_start").primaryKey(),
  assignments: jsonb("assignments").$type<Assignments>().notNull(),
  daysPerPerson: integer("days_per_person").$type<DaysPerPerson>().notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
