import { type Person } from "./people";

export const SCHEDULE_ADMINS = ["سهیل", "فاطمه جودکی"] as const satisfies readonly Person[];

export function isScheduleAdmin(person: Person): boolean {
  return (SCHEDULE_ADMINS as readonly Person[]).includes(person);
}
