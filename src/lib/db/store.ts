import { eq } from "drizzle-orm";
import type { Assignments, DaysPerPerson } from "../people";
import { inferDaysPerPerson } from "../week";
import { getDb } from "./index";
import { schedules } from "./schema";

type ScheduleRow = {
  weekStart: string;
  assignments: Assignments;
  daysPerPerson: DaysPerPerson;
  updatedAt: Date;
};

const memory = new Map<string, ScheduleRow>();

function useMemory(): boolean {
  return !process.env.DATABASE_URL;
}

function normalizeDaysPerPerson(
  value: number | null | undefined,
  assignments: Assignments,
): DaysPerPerson {
  if (value === 1 || value === 2) return value;
  return inferDaysPerPerson(assignments);
}

export async function getSchedule(
  weekStart: string,
): Promise<ScheduleRow | null> {
  if (useMemory()) {
    return memory.get(weekStart) ?? null;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.weekStart, weekStart))
    .limit(1);

  if (rows.length === 0) return null;
  return {
    weekStart: rows[0].weekStart,
    assignments: rows[0].assignments,
    daysPerPerson: normalizeDaysPerPerson(
      rows[0].daysPerPerson,
      rows[0].assignments,
    ),
    updatedAt: rows[0].updatedAt,
  };
}

export async function upsertSchedule(
  weekStart: string,
  assignments: Assignments,
  daysPerPerson: DaysPerPerson,
): Promise<ScheduleRow> {
  const updatedAt = new Date();
  const row: ScheduleRow = {
    weekStart,
    assignments,
    daysPerPerson,
    updatedAt,
  };

  if (useMemory()) {
    memory.set(weekStart, row);
    return row;
  }

  const db = getDb();
  await db
    .insert(schedules)
    .values({ weekStart, assignments, daysPerPerson, updatedAt })
    .onConflictDoUpdate({
      target: schedules.weekStart,
      set: { assignments, daysPerPerson, updatedAt },
    });

  return row;
}
