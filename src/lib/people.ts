export const PEOPLE = [
  "سهیل",
  "پریسا",
  "فاطمه جودکی",
  "کاویان",
  "فاطمه منصوری",
  "محمد رضا زارع",
] as const;

export type Person = (typeof PEOPLE)[number];

export const WORK_DAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
] as const;

export type WorkDay = (typeof WORK_DAYS)[number];

export const WEEKEND_DAYS = ["پنج‌شنبه", "جمعه"] as const;

export type Assignments = Record<WorkDay, string[]>;

/** How many remote workdays each person gets in a week. */
export type DaysPerPerson = 1 | 2;

export const DAYS_PER_PERSON_OPTIONS = [1, 2] as const;

export function isDaysPerPerson(value: unknown): value is DaysPerPerson {
  return value === 1 || value === 2;
}

export function emptyAssignments(): Assignments {
  return {
    شنبه: [],
    یکشنبه: [],
    دوشنبه: [],
    سه‌شنبه: [],
    چهارشنبه: [],
  };
}
