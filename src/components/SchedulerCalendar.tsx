import type { ReactNode } from "react";
import { PEOPLE, WORK_DAYS, type Assignments, type Person } from "@/lib/people";
import { formatJalaliShort, getWorkDates, toDateKey } from "@/lib/week";

type IconName = "calendar" | "request" | "down" | "plus" | "user" | "swap" | "right" | "left" | "close" | "eye" | "eye-off";

const icons: Record<IconName, ReactNode> = {
  calendar: <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4m8-4v4" />
  </>,
  request: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8m-8 4h8m-8 4h5" /></>,
  down: <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  user: <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </>,
  swap: <path d="M4 8h16m-4-4 4 4-4 4m4 4H4m4-4-4 4 4 4" />,
  right: <path d="m9 18 6-6-6-6" />,
  left: <path d="m15 18-6-6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  eye: <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
  "eye-off": <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a14 14 0 0 1-3 3.7M6.3 6.4C3.5 8.5 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4.4-.9" />,
};

export function SchedulerIcon({ name }: { name: IconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export function SchedulerBrand() {
  return (
    <div className="scheduler-brand">
      <span className="scheduler-mark"><SchedulerIcon name="calendar" /></span>
      <span>دورکار</span>
    </div>
  );
}

export function PersonAvatar({ name }: { name: string }) {
  const parts = name.split(" ");
  const initials = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)?.[0] ?? "" : "");
  const color = PEOPLE.findIndex((person) => person === name);
  return <span className="person-avatar" data-color={color} aria-hidden="true">{initials}</span>;
}

export function CalendarSkeleton() {
  return (
    <div className="calendar-grid calendar-skeleton" aria-hidden="true">
      {WORK_DAYS.map((day) => (
        <div className="calendar-day" key={day}>
          <div className="day-heading">
            <span className="skeleton-block skeleton-day" />
            <span className="skeleton-block skeleton-date" />
          </div>
          <span className="skeleton-block skeleton-person" />
        </div>
      ))}
    </div>
  );
}

export function CalendarDays({
  weekStart, today, assignments, previousAssignments, person,
}: {
  weekStart: Date;
  today: string;
  assignments: Assignments | null;
  previousAssignments?: Assignments | null;
  person?: Person;
}) {
  const workDates = getWorkDates(weekStart);

  return (
    <ol className="calendar-grid" data-published={Boolean(assignments)} aria-label="روزهای کاری">
      {WORK_DAYS.map((day) => {
        const names = assignments?.[day] ?? [];
        const date = workDates[day];
        const isToday = toDateKey(date) === today;
        return (
          <li className="calendar-day" key={day} data-today={isToday}>
            <div className="day-heading">
              <h3>{day}</h3>
              <time dateTime={toDateKey(date)}>{formatJalaliShort(date)}</time>
              {isToday && <span className="day-tag today-tag" aria-current="date">امروز</span>}
            </div>
            {assignments && (
              names.length ? (
                <ul className="calendar-people">
                  {names.map((name) => (
                    <li className="calendar-person" key={name} data-me={name === person}
                      data-reassigned={Boolean(previousAssignments && !previousAssignments[day]?.includes(name))}>
                      <PersonAvatar name={name} />
                      <span>{name}{name === person && <span className="sr-only">، روز دورکاری شما</span>}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="calendar-no-person">کسی دورکار نیست</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
