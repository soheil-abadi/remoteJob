import {
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Assignments, DaysPerPerson, WorkDay } from "../people";

export const schedules = pgTable("schedules", {
  weekStart: date("week_start").primaryKey(),
  assignments: jsonb("assignments").$type<Assignments>().notNull(),
  daysPerPerson: integer("days_per_person")
    .$type<DaysPerPerson>()
    .notNull()
    .default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Schedule = typeof schedules.$inferSelect;

export type SwapStatus = "pending" | "approved" | "rejected" | "cancelled";

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(),
  fromPerson: text("from_person").notNull(),
  toPerson: text("to_person").notNull(),
  fromDay: text("from_day").$type<WorkDay>().notNull(),
  toDay: text("to_day").$type<WorkDay>().notNull(),
  status: text("status").$type<SwapStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type SwapRequest = typeof swapRequests.$inferSelect;

export const personPins = pgTable("person_pins", {
  person: text("person").primaryKey(),
  pin: text("pin").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type PersonPin = typeof personPins.$inferSelect;

export const dayChangeNotices = pgTable("day_change_notices", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(),
  person: text("person").notNull(),
  changedBy: text("changed_by").notNull(),
  oldDays: jsonb("old_days").$type<WorkDay[]>().notNull(),
  newDays: jsonb("new_days").$type<WorkDay[]>().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type DayChangeNotice = typeof dayChangeNotices.$inferSelect;
