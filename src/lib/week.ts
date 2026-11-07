import { toJalaali } from "jalaali-js";
import {
  PEOPLE,
  WORK_DAYS,
  type Assignments,
  type DaysPerPerson,
  type WorkDay,
  emptyAssignments,
} from "./people";

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Days from Saturday: Sat=0 … Fri=6 */
function daysFromSaturday(jsDay: number): number {
  return (jsDay + 1) % 7;
}

function atNoon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return atNoon(new Date(y, m - 1, d));
}

/** Saturday (start of Persian week) for the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = atNoon(date);
  d.setDate(d.getDate() - daysFromSaturday(d.getDay()));
  return d;
}

export function addWeeks(weekStart: Date, delta: number): Date {
  const d = atNoon(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return getWeekStart(d);
}

export function getWorkDates(weekStart: Date): Record<WorkDay, Date> {
  const start = getWeekStart(weekStart);
  const result = {} as Record<WorkDay, Date>;
  WORK_DAYS.forEach((day, i) => {
    const d = atNoon(start);
    d.setDate(d.getDate() + i);
    result[day] = d;
  });
  return result;
}

function formatJalaliDay(date: Date): {
  jy: number;
  jm: number;
  jd: number;
  month: string;
} {
  const { jy, jm, jd } = toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return { jy, jm, jd, month: PERSIAN_MONTHS[jm - 1] };
}

/** e.g. «هفته ۲۱ مهر – ۲۵ مهر ۱۴۰۴» */
export function formatWeekTitle(weekStart: Date): string {
  const start = getWeekStart(weekStart);
  const end = atNoon(start);
  end.setDate(end.getDate() + 4); // Wednesday

  const a = formatJalaliDay(start);
  const b = formatJalaliDay(end);

  if (a.jy === b.jy && a.jm === b.jm) {
    return `هفته ${toPersianDigits(a.jd)} تا ${toPersianDigits(b.jd)} ${a.month} ${toPersianDigits(a.jy)}`;
  }
  if (a.jy === b.jy) {
    return `هفته ${toPersianDigits(a.jd)} ${a.month} – ${toPersianDigits(b.jd)} ${b.month} ${toPersianDigits(a.jy)}`;
  }
  return `هفته ${toPersianDigits(a.jd)} ${a.month} ${toPersianDigits(a.jy)} – ${toPersianDigits(b.jd)} ${b.month} ${toPersianDigits(b.jy)}`;
}

export function formatJalaliShort(date: Date): string {
  const { jd, month } = formatJalaliDay(date);
  return `${toPersianDigits(jd)} ${month}`;
}

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function personAlreadyOnDay(assignments: Assignments, person: string, day: WorkDay) {
  return assignments[day].includes(person);
}

/**
 * Each person gets exactly `daysPerPerson` distinct workdays.
 * Rounds fill lighter days first so load stays balanced.
 */
export function generateRandomAssignments(
  daysPerPerson: DaysPerPerson = 1,
): Assignments {
  const result = emptyAssignments();

  for (let round = 0; round < daysPerPerson; round++) {
    for (const person of shuffle(PEOPLE)) {
      const candidates = WORK_DAYS.filter(
        (day) => !personAlreadyOnDay(result, person, day),
      );
      candidates.sort((a, b) => {
        const diff = result[a].length - result[b].length;
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });
      const min = result[candidates[0]].length;
      const lightest = candidates.filter((day) => result[day].length === min);
      const day = lightest[Math.floor(Math.random() * lightest.length)];
      result[day].push(person);
    }
  }

  return result;
}

export function countDaysPerPerson(assignments: Assignments): Map<string, number> {
  const counts = new Map<string, number>();
  for (const person of PEOPLE) counts.set(person, 0);
  for (const day of WORK_DAYS) {
    for (const name of assignments[day] ?? []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

/** Infer mode from an existing schedule (for older rows without the field). */
export function inferDaysPerPerson(assignments: Assignments): DaysPerPerson {
  const counts = countDaysPerPerson(assignments);
  let max = 0;
  for (const value of counts.values()) max = Math.max(max, value);
  return max >= 2 ? 2 : 1;
}

export function validateAssignments(
  assignments: Assignments,
  daysPerPerson: DaysPerPerson = 1,
): { ok: true } | { ok: false; error: string } {
  const counts = new Map<string, number>();
  for (const person of PEOPLE) counts.set(person, 0);

  for (const day of WORK_DAYS) {
    const names = assignments[day] ?? [];
    if (!Array.isArray(names)) {
      return { ok: false, error: `روز ${day} نامعتبر است.` };
    }
    const onDay = new Set<string>();
    for (const name of names) {
      if (!PEOPLE.includes(name as (typeof PEOPLE)[number])) {
        return { ok: false, error: `نام ناشناخته: ${name}` };
      }
      if (onDay.has(name)) {
        return { ok: false, error: `${name} در ${day} تکراری است.` };
      }
      onDay.add(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  for (const person of PEOPLE) {
    const count = counts.get(person) ?? 0;
    if (count !== daysPerPerson) {
      return {
        ok: false,
        error: `${person} باید دقیقاً ${daysPerPerson} روز داشته باشد (الان ${count}).`,
      };
    }
  }

  return { ok: true };
}

/** Build assignments from person → days map (manual edit UI). */
export function assignmentsFromPersonMap(
  personDays: Record<string, WorkDay[]>,
): Assignments {
  const result = emptyAssignments();
  for (const person of PEOPLE) {
    const days = personDays[person] ?? [];
    for (const day of days) {
      if (WORK_DAYS.includes(day) && !result[day].includes(person)) {
        result[day].push(person);
      }
    }
  }
  return result;
}

export function personMapFromAssignments(
  assignments: Assignments,
): Record<string, WorkDay[]> {
  const map: Record<string, WorkDay[]> = {};
  for (const person of PEOPLE) {
    map[person] = [];
  }
  for (const day of WORK_DAYS) {
    for (const person of assignments[day] ?? []) {
      if (!map[person].includes(day)) {
        map[person].push(day);
      }
    }
  }
  return map;
}
