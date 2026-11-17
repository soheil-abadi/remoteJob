"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PEOPLE,
  WORK_DAYS,
  type Assignments,
  type DaysPerPerson,
  type Person,
  type WorkDay,
} from "@/lib/people";
import { formatJalaliShort, personMapFromAssignments, toPersianDigits } from "@/lib/week";
import {
  errorMessage,
  postJson,
  type Feedback,
  type RunWeekAction,
  type Schedule,
  type Session,
} from "./scheduler-client";

type ReassignResult = Schedule & {
  notices?: unknown[];
};

export function SchedulerAdminReassign({
  session,
  weekKey,
  workDates,
  assignments,
  daysPerPerson,
  busy,
  runAction,
  onScheduleChange,
}: {
  session: Session;
  weekKey: string;
  workDates: Record<WorkDay, Date>;
  assignments: Assignments;
  daysPerPerson: DaysPerPerson;
  busy: boolean;
  runAction: RunWeekAction;
  onScheduleChange: (schedule: Schedule) => void;
}) {
  const personDays = useMemo(() => personMapFromAssignments(assignments), [assignments]);
  const [person, setPerson] = useState<Person>(PEOPLE[0]);
  const [selected, setSelected] = useState<WorkDay[]>(() => personDays[PEOPLE[0]] ?? []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (saving) return;
    setSelected(personDays[person] ?? []);
  }, [person, personDays, saving]);

  function selectPerson(next: Person) {
    setPerson(next);
    setFeedback(null);
  }

  function toggleDay(day: WorkDay) {
    setFeedback(null);
    setSelected((current) => {
      if (current.includes(day)) return current.filter((value) => value !== day);
      if (daysPerPerson === 1) return [day];
      if (current.length >= daysPerPerson) return [...current.slice(1), day];
      return [...current, day];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || busy) return;
    const fallback = "تغییر روزها انجام نشد. دوباره تلاش کنید.";
    setSaving(true);
    setFeedback(null);
    try {
      const data = await runAction(() =>
        postJson<ReassignResult>(
          "/api/schedule/reassign",
          { weekStart: weekKey, pin: session.pin, person, days: selected },
          fallback,
        ),
      );
      onScheduleChange({
        assignments: data.assignments,
        daysPerPerson: data.daysPerPerson,
      });
      setSelected(personMapFromAssignments(data.assignments ?? assignments)[person] ?? selected);
      setFeedback({
        kind: "success",
        message: `روزهای ${person} به‌روز شد و اعلان برای افراد مرتبط ثبت شد.`,
      });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error, fallback) });
    } finally {
      setSaving(false);
    }
  }

  const ready = selected.length === daysPerPerson;
  const dayLabel = (day: WorkDay) => `${day}، ${formatJalaliShort(workDates[day])}`;

  return (
    <form className="swap-card admin-reassign" onSubmit={(event) => void submit(event)}>
      <h3>تغییر روز همکاران</h3>
      <p className="muted">
        دقیقاً {toPersianDigits(daysPerPerson)} روز برای هر نفر انتخاب کنید. بعد از ذخیره، اعلان داخل برنامه برای افراد تغییرکرده ثبت می‌شود.
      </p>
      <fieldset className="swap-fields" disabled={saving || busy}>
        <div className="form-field">
          <label htmlFor="admin-reassign-person">همکار</label>
          <select
            className="control"
            id="admin-reassign-person"
            value={person}
            onChange={(event) => selectPerson(event.target.value as Person)}
          >
            {PEOPLE.map((name) => (
              <option value={name} key={name}>{name}</option>
            ))}
          </select>
        </div>
        <fieldset className="day-options admin-day-options">
          <legend>روزهای دورکاری</legend>
          {WORK_DAYS.map((day) => (
            <label className="day-option" key={day}>
              <input
                type="checkbox"
                checked={selected.includes(day)}
                onChange={() => toggleDay(day)}
              />
              <span>{dayLabel(day)}</span>
            </label>
          ))}
        </fieldset>
      </fieldset>
      {feedback && (
        <p className={`feedback feedback-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      )}
      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={saving || busy || !ready}>
          {saving ? "در حال ذخیره…" : "ذخیرهٔ روزها"}
        </button>
      </div>
    </form>
  );
}
