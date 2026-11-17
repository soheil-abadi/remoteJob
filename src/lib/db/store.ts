import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Assignments, DaysPerPerson, WorkDay } from "../people";
import { inferDaysPerPerson } from "../week";
import { getDb } from "./index";
import {
  dayChangeNotices,
  personPins,
  schedules,
  swapRequests,
  type DayChangeNotice,
  type SwapRequest,
  type SwapStatus,
} from "./schema";

type ScheduleRow = {
  weekStart: string;
  assignments: Assignments;
  daysPerPerson: DaysPerPerson;
  updatedAt: Date;
};

export type SwapRequestRow = {
  id: number;
  weekStart: string;
  fromPerson: string;
  toPerson: string;
  fromDay: WorkDay;
  toDay: WorkDay;
  status: SwapStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DayChangeNoticeRow = {
  id: number;
  weekStart: string;
  person: string;
  changedBy: string;
  oldDays: WorkDay[];
  newDays: WorkDay[];
  readAt: Date | null;
  createdAt: Date;
};

const memory = new Map<string, ScheduleRow>();
const memorySwaps = new Map<number, SwapRequestRow>();
const memoryPins = new Map<string, string>();
const memoryNotices = new Map<number, DayChangeNoticeRow>();
let memorySwapId = 1;
let memoryNoticeId = 1;

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

function toSwapRow(row: SwapRequest): SwapRequestRow {
  return {
    id: row.id,
    weekStart: row.weekStart,
    fromPerson: row.fromPerson,
    toPerson: row.toPerson,
    fromDay: row.fromDay,
    toDay: row.toDay,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

export async function createSwapRequest(input: {
  weekStart: string;
  fromPerson: string;
  toPerson: string;
  fromDay: WorkDay;
  toDay: WorkDay;
}): Promise<SwapRequestRow> {
  const now = new Date();

  if (useMemory()) {
    const row: SwapRequestRow = {
      id: memorySwapId++,
      weekStart: input.weekStart,
      fromPerson: input.fromPerson,
      toPerson: input.toPerson,
      fromDay: input.fromDay,
      toDay: input.toDay,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    memorySwaps.set(row.id, row);
    return row;
  }

  const db = getDb();
  const inserted = await db
    .insert(swapRequests)
    .values({
      weekStart: input.weekStart,
      fromPerson: input.fromPerson,
      toPerson: input.toPerson,
      fromDay: input.fromDay,
      toDay: input.toDay,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toSwapRow(inserted[0]);
}

export async function getSwapRequest(
  id: number,
): Promise<SwapRequestRow | null> {
  if (useMemory()) {
    return memorySwaps.get(id) ?? null;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(swapRequests)
    .where(eq(swapRequests.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  return toSwapRow(rows[0]);
}

export async function listPendingSwapsForPerson(input: {
  weekStart: string;
  person: string;
}): Promise<{ incoming: SwapRequestRow[]; outgoing: SwapRequestRow[] }> {
  if (useMemory()) {
    const pending = [...memorySwaps.values()]
      .filter(
        (row) =>
          row.weekStart === input.weekStart &&
          row.status === "pending" &&
          (row.fromPerson === input.person || row.toPerson === input.person),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      incoming: pending.filter((row) => row.toPerson === input.person),
      outgoing: pending.filter((row) => row.fromPerson === input.person),
    };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(swapRequests)
    .where(
      and(
        eq(swapRequests.weekStart, input.weekStart),
        eq(swapRequests.status, "pending"),
        or(
          eq(swapRequests.fromPerson, input.person),
          eq(swapRequests.toPerson, input.person),
        ),
      ),
    )
    .orderBy(desc(swapRequests.createdAt));

  const mapped = rows.map(toSwapRow);
  return {
    incoming: mapped.filter((row) => row.toPerson === input.person),
    outgoing: mapped.filter((row) => row.fromPerson === input.person),
  };
}

export async function updateSwapStatus(
  id: number,
  status: SwapStatus,
): Promise<SwapRequestRow | null> {
  const updatedAt = new Date();

  if (useMemory()) {
    const existing = memorySwaps.get(id);
    if (!existing) return null;
    const next = { ...existing, status, updatedAt };
    memorySwaps.set(id, next);
    return next;
  }

  const db = getDb();
  const updated = await db
    .update(swapRequests)
    .set({ status, updatedAt })
    .where(eq(swapRequests.id, id))
    .returning();

  if (updated.length === 0) return null;
  return toSwapRow(updated[0]);
}

/** Custom PIN overrides keyed by person name. */
export async function getPersonPinOverrides(): Promise<Record<string, string>> {
  if (useMemory()) {
    return Object.fromEntries(memoryPins.entries());
  }

  const db = getDb();
  const rows = await db.select().from(personPins);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.person] = row.pin;
  }
  return map;
}

export async function upsertPersonPin(
  person: string,
  pin: string,
): Promise<void> {
  const updatedAt = new Date();

  if (useMemory()) {
    memoryPins.set(person, pin);
    return;
  }

  const db = getDb();
  await db
    .insert(personPins)
    .values({ person, pin, updatedAt })
    .onConflictDoUpdate({
      target: personPins.person,
      set: { pin, updatedAt },
    });
}

function toNoticeRow(row: DayChangeNotice): DayChangeNoticeRow {
  return {
    id: row.id,
    weekStart: row.weekStart,
    person: row.person,
    changedBy: row.changedBy,
    oldDays: row.oldDays,
    newDays: row.newDays,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export async function createDayChangeNotices(
  notices: Array<{
    weekStart: string;
    person: string;
    changedBy: string;
    oldDays: WorkDay[];
    newDays: WorkDay[];
  }>,
): Promise<DayChangeNoticeRow[]> {
  if (notices.length === 0) return [];

  if (useMemory()) {
    const createdAt = new Date();
    return notices.map((notice) => {
      const row: DayChangeNoticeRow = {
        id: memoryNoticeId++,
        weekStart: notice.weekStart,
        person: notice.person,
        changedBy: notice.changedBy,
        oldDays: notice.oldDays,
        newDays: notice.newDays,
        readAt: null,
        createdAt,
      };
      memoryNotices.set(row.id, row);
      return row;
    });
  }

  const db = getDb();
  const inserted = await db
    .insert(dayChangeNotices)
    .values(
      notices.map((notice) => ({
        weekStart: notice.weekStart,
        person: notice.person,
        changedBy: notice.changedBy,
        oldDays: notice.oldDays,
        newDays: notice.newDays,
      })),
    )
    .returning();

  return inserted.map(toNoticeRow);
}

export async function listDayChangeNoticesForPerson(input: {
  weekStart: string;
  person: string;
}): Promise<DayChangeNoticeRow[]> {
  if (useMemory()) {
    return [...memoryNotices.values()]
      .filter(
        (row) =>
          row.weekStart === input.weekStart && row.person === input.person,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(dayChangeNotices)
    .where(
      and(
        eq(dayChangeNotices.weekStart, input.weekStart),
        eq(dayChangeNotices.person, input.person),
      ),
    )
    .orderBy(desc(dayChangeNotices.createdAt));

  return rows.map(toNoticeRow);
}

export async function markDayChangeNoticesRead(input: {
  person: string;
  ids?: number[];
  weekStart?: string;
}): Promise<number> {
  const readAt = new Date();

  if (useMemory()) {
    let count = 0;
    for (const row of memoryNotices.values()) {
      if (row.person !== input.person || row.readAt) continue;
      if (input.ids && !input.ids.includes(row.id)) continue;
      if (input.weekStart && row.weekStart !== input.weekStart) continue;
      memoryNotices.set(row.id, { ...row, readAt });
      count += 1;
    }
    return count;
  }

  const db = getDb();
  const filters = [
    eq(dayChangeNotices.person, input.person),
    isNull(dayChangeNotices.readAt),
  ];
  if (input.ids?.length) filters.push(inArray(dayChangeNotices.id, input.ids));
  if (input.weekStart) {
    filters.push(eq(dayChangeNotices.weekStart, input.weekStart));
  }

  const updated = await db
    .update(dayChangeNotices)
    .set({ readAt })
    .where(and(...filters))
    .returning({ id: dayChangeNotices.id });

  return updated.length;
}
