"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PEOPLE,
  WORK_DAYS,
  type Assignments,
  type DaysPerPerson,
  type WorkDay,
  emptyAssignments,
  isDaysPerPerson,
} from "@/lib/people";
import {
  addWeeks,
  assignmentsFromPersonMap,
  formatJalaliShort,
  formatWeekTitle,
  getWeekStart,
  getWorkDates,
  personMapFromAssignments,
  parseDateKey,
  toDateKey,
  toPersianDigits,
  validateAssignments,
} from "@/lib/week";

const PASSWORD_KEY = "remote-edit-password";
const DAYS_KEY = "remote-days-per-person";

type LoadState = "loading" | "ready" | "error";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`;
}

type Props = {
  initialWeekStart: string;
};

export default function WeekScheduler({ initialWeekStart }: Props) {
  const [weekStart, setWeekStart] = useState(() => parseDateKey(initialWeekStart));
  const [assignments, setAssignments] = useState<Assignments | null>(null);
  const [daysPerPerson, setDaysPerPerson] = useState<DaysPerPerson>(1);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [personDays, setPersonDays] = useState<Record<string, WorkDay[]>>({});
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isCurrentWeek, setIsCurrentWeek] = useState(true);

  const weekKey = toDateKey(weekStart);
  const title = useMemo(() => formatWeekTitle(weekStart), [weekStart]);
  const workDates = useMemo(() => getWorkDates(weekStart), [weekStart]);

  useEffect(() => {
    const savedPassword = localStorage.getItem(PASSWORD_KEY);
    if (savedPassword) setPassword(savedPassword);
    const savedDays = Number(localStorage.getItem(DAYS_KEY));
    if (isDaysPerPerson(savedDays)) setDaysPerPerson(savedDays);
  }, []);

  useEffect(() => {
    setIsCurrentWeek(
      toDateKey(weekStart) === toDateKey(getWeekStart(new Date())),
    );
  }, [weekStart]);

  const load = useCallback(async (key: string) => {
    setLoadState("loading");
    setError(null);
    setMessage(null);
    setEditing(false);
    try {
      const res = await fetch(`/api/schedule?weekStart=${key}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در بارگذاری");
      setAssignments(data.assignments);
      if (isDaysPerPerson(data.daysPerPerson)) {
        setDaysPerPerson(data.daysPerPerson);
      } else {
        const savedDays = Number(localStorage.getItem(DAYS_KEY));
        if (isDaysPerPerson(savedDays)) setDaysPerPerson(savedDays);
      }
      setLoadState("ready");
    } catch (err) {
      setLoadState("error");
      setError(err instanceof Error ? err.message : "خطا در بارگذاری");
      setAssignments(null);
    }
  }, []);

  useEffect(() => {
    if (!weekKey) return;
    void load(weekKey);
  }, [weekKey, load]);

  function rememberPassword(value: string) {
    setPassword(value);
    if (value) localStorage.setItem(PASSWORD_KEY, value);
  }

  function changeDaysPerPerson(value: DaysPerPerson) {
    setDaysPerPerson(value);
    localStorage.setItem(DAYS_KEY, String(value));
    if (editing) {
      setPersonDays((prev) => {
        const next: Record<string, WorkDay[]> = {};
        for (const person of PEOPLE) {
          next[person] = (prev[person] ?? []).slice(0, value);
        }
        return next;
      });
    }
  }

  function startEdit() {
    setPersonDays(personMapFromAssignments(assignments ?? emptyAssignments()));
    setEditing(true);
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function togglePersonDay(person: string, day: WorkDay) {
    setPersonDays((prev) => {
      const current = prev[person] ?? [];
      if (current.includes(day)) {
        return { ...prev, [person]: current.filter((d) => d !== day) };
      }
      if (current.length >= daysPerPerson) {
        if (daysPerPerson === 1) {
          return { ...prev, [person]: [day] };
        }
        return prev;
      }
      return { ...prev, [person]: [...current, day] };
    });
  }

  async function saveManual() {
    const next = assignmentsFromPersonMap(personDays);
    const validation = validateAssignments(next, daysPerPerson);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekKey,
          assignments: next,
          daysPerPerson,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ذخیره نشد");
      if (password) localStorage.setItem(PASSWORD_KEY, password);
      setAssignments(data.assignments);
      if (isDaysPerPerson(data.daysPerPerson)) {
        setDaysPerPerson(data.daysPerPerson);
      }
      setEditing(false);
      setMessage("برنامه ذخیره شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  async function generateRandom() {
    if (
      assignments &&
      !window.confirm("برنامه فعلی این هفته جایگزین می‌شود. ادامه؟")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekKey,
          daysPerPerson,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تولید نشد");
      if (password) localStorage.setItem(PASSWORD_KEY, password);
      setAssignments(data.assignments);
      if (isDaysPerPerson(data.daysPerPerson)) {
        setDaysPerPerson(data.daysPerPerson);
      }
      setEditing(false);
      setMessage("برنامه تصادفی ساخته و ذخیره شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تولید نشد");
    } finally {
      setBusy(false);
    }
  }

  const hasSchedule = Boolean(assignments);
  const guideText =
    daysPerPerson === 2
      ? "هر نفر دو روز از شنبه تا چهارشنبه. پنج‌شنبه و جمعه تعطیل است."
      : "هر نفر یک روز از شنبه تا چهارشنبه. پنج‌شنبه و جمعه تعطیل است.";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-4xl font-black tracking-tight text-[var(--ink)] sm:text-5xl">
              دورکار
            </p>
            <p className="text-sm text-[var(--muted)]">برنامه دورکاری تیم</p>
          </div>

          <nav className="week-nav self-start" aria-label="ناوبری هفته">
            <button
              type="button"
              className="btn-nav"
              onClick={() => setWeekStart((w) => addWeeks(w, -1))}
              disabled={busy}
            >
              قبل
            </button>
            <button
              type="button"
              className={`btn-nav ${isCurrentWeek ? "is-active" : ""}`}
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              disabled={busy}
            >
              جاری
            </button>
            <button
              type="button"
              className="btn-nav"
              onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              disabled={busy}
            >
              بعد
            </button>
          </nav>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="max-w-3xl text-2xl font-extrabold leading-snug text-[var(--ink)] sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
            {guideText}
          </p>
        </div>
      </header>

      <section
        key={weekKey}
        className="week-board overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]/90"
        aria-live="polite"
      >
        {loadState === "loading" && (
          <div className="grid grid-cols-1 divide-y divide-[var(--line)] md:grid-cols-5 md:divide-x md:divide-y-0 md:divide-[var(--line)]">
            {WORK_DAYS.map((day) => (
              <div key={day} className="day-lane">
                <div className="skeleton-block h-5 w-16" />
                <div className="skeleton-block h-4 w-20" />
                <div className="mt-2 flex flex-col gap-2">
                  <div className="skeleton-block h-10 w-full" />
                  <div className="skeleton-block h-10 w-[80%]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {loadState === "error" && (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-[var(--danger)]">{error}</p>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void load(weekKey)}
            >
              تلاش دوباره
            </button>
          </div>
        )}

        {loadState === "ready" && !editing && (
          <>
            <div className="grid grid-cols-1 divide-y divide-[var(--line)] md:grid-cols-5 md:divide-x md:divide-y-0 md:divide-[var(--line)]">
              {WORK_DAYS.map((day) => {
                const names = assignments?.[day] ?? [];
                const isBusyDay = names.length >= 2;
                return (
                  <article
                    key={day}
                    className={`day-lane ${isBusyDay ? "is-double" : ""}`}
                  >
                    <div className="flex flex-col gap-1">
                      <h2 className="text-lg font-bold text-[var(--ink)]">
                        {day}
                      </h2>
                      <p className="text-sm text-[var(--muted)]">
                        {formatJalaliShort(workDates[day])}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                      {!hasSchedule ? (
                        <span className="text-sm text-[var(--muted)]">—</span>
                      ) : names.length === 0 ? (
                        <span className="text-sm text-[var(--muted)]">—</span>
                      ) : (
                        names.map((name) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 rounded-[10px] bg-white/70 px-2.5 py-2"
                          >
                            <span className="avatar" aria-hidden>
                              {initials(name)}
                            </span>
                            <span className="text-sm font-semibold leading-5 text-[var(--ink)]">
                              {name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {!hasSchedule && (
              <div className="border-t border-[var(--line)] bg-[var(--jade-soft)]/50 px-5 py-5 text-center sm:text-right">
                <p className="text-sm leading-6 text-[var(--jade-dark)]">
                  برای این هفته هنوز برنامه‌ای نیست. با «تولید تصادفی» شروع کنید
                  یا دستی تنظیم کنید.
                </p>
              </div>
            )}
          </>
        )}

        {loadState === "ready" && editing && (
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <p className="text-sm leading-6 text-[var(--muted)]">
              برای هر نفر دقیقاً {toPersianDigits(daysPerPerson)} روز کاری
              انتخاب کنید.
            </p>
            <div className="grid gap-3">
              {PEOPLE.map((person) => {
                const selected = personDays[person] ?? [];
                return (
                  <div
                    key={person}
                    className="flex flex-col gap-3 rounded-[12px] border border-[var(--line)] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                        <span className="avatar" aria-hidden>
                          {initials(person)}
                        </span>
                        {person}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {toPersianDigits(selected.length)}/
                        {toPersianDigits(daysPerPerson)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WORK_DAYS.map((day) => {
                        const active = selected.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className={`rounded-[10px] border px-3 py-2 text-sm font-medium transition ${
                              active
                                ? "border-[var(--jade)] bg-[var(--jade-soft)] text-[var(--jade-dark)]"
                                : "border-[var(--line)] bg-white text-[var(--muted)]"
                            }`}
                            onClick={() => togglePersonDay(person, day)}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--mist)]/80 px-5 py-3 text-sm text-[var(--muted)]">
          <span>پنج‌شنبه · جمعه</span>
          <span className="font-medium">تعطیل</span>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">
            تعداد روز دورکاری هر نفر
          </span>
          <div className="week-nav self-start" role="group" aria-label="تنظیم روزها">
            <button
              type="button"
              className={`btn-nav ${daysPerPerson === 1 ? "is-active" : ""}`}
              onClick={() => changeDaysPerPerson(1)}
              disabled={busy}
            >
              ۱ روز
            </button>
            <button
              type="button"
              className={`btn-nav ${daysPerPerson === 2 ? "is-active" : ""}`}
              onClick={() => changeDaysPerPerson(2)}
              disabled={busy}
            >
              ۲ روز
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void generateRandom()}
                  disabled={busy || loadState !== "ready"}
                >
                  {busy ? "در حال اجرا…" : "تولید تصادفی"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={startEdit}
                  disabled={busy || loadState !== "ready"}
                >
                  ویرایش دستی
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void saveManual()}
                  disabled={busy}
                >
                  {busy ? "در حال ذخیره…" : "ذخیره"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={cancelEdit}
                  disabled={busy}
                >
                  انصراف
                </button>
              </>
            )}
          </div>

          <label className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[14rem]">
            <span className="text-xs font-medium text-[var(--muted)]">
              رمز ویرایش
            </span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => rememberPassword(e.target.value)}
              placeholder="رمز سرور"
              autoComplete="current-password"
            />
          </label>
        </div>

        {error && loadState === "ready" && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm font-medium text-[var(--jade-dark)]" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
