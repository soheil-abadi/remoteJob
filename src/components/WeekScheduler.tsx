"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { DAYS_PER_PERSON_OPTIONS, isDaysPerPerson, type Assignments, type DaysPerPerson } from "@/lib/people";
import {
  addWeeks, formatJalaliShort, formatWeekTitle, getWeekStart, getWorkDates,
  parseDateKey, personMapFromAssignments, toDateKey, toPersianDigits,
} from "@/lib/week";
import { SchedulerAccount } from "./SchedulerAccount";
import { CalendarDays, CalendarSkeleton, PersonAvatar, SchedulerBrand, SchedulerIcon } from "./SchedulerCalendar";
import { SchedulerSwaps, SwapHeader } from "./SchedulerSwaps";
import { gsap, useSchedulerMotion } from "./scheduler-motion";
import {
  errorMessage, postJson, readPreference, RequestError, savePreference, useSchedulerResource,
  type Feedback, type RunWeekAction, type Schedule, type Session,
} from "./scheduler-client";

const PIN_KEY = "remote-person-pin";
const DAYS_KEY = "remote-days-per-person";
const SCHEDULE_ADMIN = "سهیل";

type OpenAccount = (event: MouseEvent<HTMLButtonElement>) => void;

function WeekContent({
  weekKey, today, session, restoring, preference, onPreferenceChange, openAccount, runAction,
  direction, swapsOpen, setSwapsOpen,
}: {
  weekKey: string;
  today: string;
  session: Session | null;
  restoring: boolean;
  preference: DaysPerPerson;
  onPreferenceChange: (value: DaysPerPerson) => void;
  openAccount: OpenAccount;
  runAction: RunWeekAction;
  direction: -1 | 0 | 1;
  swapsOpen: boolean;
  setSwapsOpen: (open: boolean) => void;
}) {
  const schedule = useSchedulerResource<Schedule>(
    `/api/schedule?weekStart=${encodeURIComponent(weekKey)}`,
    "بارگذاری برنامه انجام نشد.",
  );
  const [creating, setCreating] = useState(false);
  const [creationFeedback, setCreationFeedback] = useState<Feedback | null>(null);
  const [previousAssignments, setPreviousAssignments] = useState<Assignments | null>(null);
  const calendarPanel = useRef<HTMLElement>(null);
  const personalDays = useRef<HTMLElement>(null);
  const info = schedule.result.status === "ready" ? schedule.result.data : null;
  const assignments = info?.assignments ?? null;
  const isAdmin = session?.person === SCHEDULE_ADMIN;
  const myDays = session && assignments ? personMapFromAssignments(assignments)[session.person] ?? [] : [];
  const weekStart = parseDateKey(weekKey);
  const workDates = getWorkDates(weekStart);

  const ready = Boolean(info);
  const published = Boolean(assignments);
  const showPersonalDays = Boolean(session && published);

  useSchedulerMotion(() => {
    const grid = calendarPanel.current?.querySelector(".calendar-grid");
    if (!ready || !grid) return;
    gsap.fromTo(grid, { opacity: 0.62, x: direction * -12, y: direction ? 0 : 6 }, {
      opacity: 1, x: 0, y: 0, duration: 0.29, ease: "power2.out", clearProps: "transform,opacity",
    });
  }, [ready, published, direction]);

  useSchedulerMotion(() => {
    if (!personalDays.current) return;
    gsap.fromTo(personalDays.current, { opacity: 0.72, y: 6 }, {
      opacity: 1, y: 0, duration: 0.24, ease: "power2.out", clearProps: "transform,opacity",
    });
  }, [showPersonalDays]);

  useSchedulerMotion(() => {
    const moved = calendarPanel.current?.querySelectorAll("[data-reassigned='true']");
    if (!moved?.length) return;
    gsap.fromTo(moved, { y: 6, backgroundColor: "#d5ead5" }, {
      y: 0, backgroundColor: "#d5ead500", duration: 0.68, ease: "power2.out",
      clearProps: "transform,backgroundColor",
    });
  }, [assignments, previousAssignments]);

  function updateSchedule(next: Schedule) {
    setPreviousAssignments(assignments);
    schedule.replace(next);
  }

  async function generate() {
    if (!isAdmin || !info || assignments || creating) return;
    const fallback = "ساخت برنامه انجام نشد. دوباره تلاش کنید.";
    setCreating(true);
    setCreationFeedback(null);
    try {
      const data = await runAction(() => postJson<Schedule>(
        "/api/schedule/random", { weekStart: weekKey, daysPerPerson: preference, pin: session.pin }, fallback,
      ));
      schedule.replace(data);
      setCreationFeedback({ kind: "success", message: "برنامهٔ این هفته ساخته و ذخیره شد." });
      calendarPanel.current?.focus();
    } catch (error) {
      setCreationFeedback({ kind: "error", message: errorMessage(error, fallback) });
      if (error instanceof RequestError && error.status === 409) schedule.reload();
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {showPersonalDays && (
        <aside ref={personalDays} className="personal-days" aria-labelledby="personal-title">
          <h2 id="personal-title">روزهای دورکاری شما</h2>
          {myDays.length > 0 ? (
            <ul>{myDays.map((day) => (
              <li key={day}><strong>{day}</strong><span>{formatJalaliShort(workDates[day])}</span></li>
            ))}</ul>
          ) : <p className="muted">برای شما روزی در این هفته ثبت نشده است.</p>}
        </aside>
      )}

      <section ref={calendarPanel} id="team-calendar" className="calendar-panel"
        tabIndex={-1} aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="sr-only">تقویم هفته</h2>
        {schedule.result.status === "loading" && <>
          <p className="sr-only" role="status">در حال بارگذاری برنامهٔ هفته…</p>
          <CalendarSkeleton />
        </>}
        {schedule.result.status === "error" && (
          <div className="calendar-state status-actions">
            <p className="feedback feedback-error" role="alert">{schedule.result.message}</p>
            <button className="button" type="button" onClick={() => {
              calendarPanel.current?.focus();
              schedule.reload();
            }}>تلاش دوباره برای برنامه</button>
          </div>
        )}
        {info && (
          <>
            <CalendarDays weekStart={weekStart} today={today} assignments={assignments}
              previousAssignments={previousAssignments} person={session?.person} />
            {!assignments && (
              <div className="calendar-state unpublished">
                <div>
                  <h3>برنامهٔ این هفته هنوز منتشر نشده است</h3>
                  {isAdmin && <p className="muted">تعداد روزهای دورکاری هر نفر را انتخاب کنید.</p>}
                </div>
                {isAdmin && (
                  <form className="create-schedule" onSubmit={(event) => {
                    event.preventDefault();
                    void generate();
                  }} aria-busy={creating}>
                    <fieldset className="day-options" disabled={creating}>
                      <legend className="sr-only">تعداد روزهای دورکاری هر نفر</legend>
                      {DAYS_PER_PERSON_OPTIONS.map((days) => (
                        <label className="day-option" key={days}>
                          <input type="radio" name="days-per-person" value={days} checked={preference === days}
                            onChange={() => onPreferenceChange(days)} />
                          <span>{toPersianDigits(days)} روز</span>
                        </label>
                      ))}
                    </fieldset>
                    <button className="button button-primary" type="submit" disabled={creating}>
                      {creating ? "در حال ساخت برنامه…" : "ساخت و ذخیرهٔ برنامه"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
        {creationFeedback && (isAdmin || creationFeedback.kind === "success") && (
          <p className={`calendar-feedback feedback feedback-${creationFeedback.kind}`}
            role={creationFeedback.kind === "error" ? "alert" : "status"}>{creationFeedback.message}</p>
        )}
        <p className="calendar-footer">
          <span>پنج‌شنبه و جمعه تعطیل است.</span>
          {info?.daysPerPerson && <span>{toPersianDigits(info.daysPerPerson)} روز دورکاری برای هر نفر</span>}
        </p>
      </section>

      <section id="swap-requests" className="swaps-section" aria-labelledby="swaps-title">
        {session ? (
          <SchedulerSwaps key={session.person} session={session} assignments={assignments} myDays={myDays}
            weekKey={weekKey} weekStart={weekStart} runAction={runAction}
            onScheduleChange={updateSchedule} onScheduleConflict={() => {
              setPreviousAssignments(null);
              schedule.reload();
            }}
            expanded={swapsOpen} onExpand={() => setSwapsOpen(true)} onToggle={() => setSwapsOpen(!swapsOpen)} />
        ) : (
          <>
            <SwapHeader expanded={swapsOpen} onToggle={() => setSwapsOpen(!swapsOpen)}
              onNewRequest={(event) => {
                setSwapsOpen(true);
                openAccount(event);
              }} guest disabled={restoring} />
            <div id="swap-content" hidden={!swapsOpen}>
              <div className="swap-card swap-guest">
                <p className="muted">برای فرستادن درخواست یا پاسخ به همکاران وارد شوید.</p>
                <button className="button button-secondary" type="button" aria-haspopup="dialog"
                  onClick={openAccount} disabled={restoring}>ورود با پین</button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export default function WeekScheduler({ initialWeekStart, initialToday }: {
  initialWeekStart: string;
  initialToday: string;
}) {
  const [{ key: weekKey, direction }, setWeek] = useState<{ key: string; direction: -1 | 0 | 1 }>(
    { key: initialWeekStart, direction: 0 },
  );
  const [swapsOpen, setSwapsOpen] = useState(false);
  const [today, setToday] = useState(initialToday);
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [preference, setPreference] = useState<DaysPerPerson>(1);
  const [mutating, setMutating] = useState(false);
  const actionInFlight = useRef(false);
  const headerAccount = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const isCurrent = weekKey === toDateKey(getWeekStart(parseDateKey(today)));

  useEffect(() => {
    function followAnchor() {
      if (window.location.hash === "#swap-requests") setSwapsOpen(true);
      if (window.location.hash === "#week-program") setSwapsOpen(false);
    }
    queueMicrotask(followAnchor);
    window.addEventListener("hashchange", followAnchor);
    return () => window.removeEventListener("hashchange", followAnchor);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setToday(toDateKey(new Date()));
      const savedDays = Number(readPreference(DAYS_KEY));
      if (isDaysPerPerson(savedDays)) setPreference(savedDays);
      const pin = readPreference(PIN_KEY);

      try {
        if (pin) {
          const { person } = await postJson<Pick<Session, "person">>(
            "/api/auth/login", { pin }, "بازیابی حساب انجام نشد.", controller.signal,
          );
          if (!controller.signal.aborted) setSession({ person, pin });
        }
      } catch (error) {
        if (!controller.signal.aborted && error instanceof RequestError && error.status === 401) {
          savePreference(PIN_KEY, null);
        }
      } finally {
        if (!controller.signal.aborted) setRestoring(false);
      }
    });
    return () => controller.abort();
  }, []);

  const runAction: RunWeekAction = async (action) => {
    if (actionInFlight.current) throw new RequestError("اقدام قبلی هنوز در حال انجام است.", 0);
    actionInFlight.current = true;
    setMutating(true);
    try {
      return await action();
    } finally {
      actionInFlight.current = false;
      setMutating(false);
    }
  };

  function openAccount(event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    setAccountStatus(null);
    setAccountOpen(true);
  }

  function closeAccount() {
    setAccountOpen(false);
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected ? opener.current : headerAccount.current;
      target?.focus();
      opener.current = null;
    });
  }

  function changeSession(next: Session | null, message: string | null) {
    setSession(next);
    setAccountStatus(message);
    savePreference(PIN_KEY, next?.pin ?? null);
  }

  function navigateWeek(offset: -1 | 0 | 1) {
    if (actionInFlight.current) return;
    const now = new Date();
    setToday(toDateKey(now));
    setWeek((current) => {
      const key = offset === 0
        ? toDateKey(getWeekStart(now))
        : toDateKey(addWeeks(parseDateKey(current.key), offset));
      if (key === current.key) return current;
      return { key, direction: key > current.key ? 1 : -1 };
    });
  }

  return (
    <div className="scheduler-shell">
      <header className="scheduler-header">
        <div className="scheduler-frame scheduler-header-inner">
          <SchedulerBrand />
          <nav className="sidebar-nav" aria-label="بخش‌های دورکار">
            <a href="#week-program" aria-current={!swapsOpen ? "location" : undefined}
              onClick={() => setSwapsOpen(false)}><SchedulerIcon name="calendar" />برنامهٔ هفته</a>
            <a href="#swap-requests" aria-current={swapsOpen ? "location" : undefined}
              onClick={() => setSwapsOpen(true)}><SchedulerIcon name="request" />درخواست‌ها</a>
          </nav>
          <div className="header-actions">
            {accountStatus && <span className="account-status" role="status">{accountStatus}</span>}
            <button type="button" ref={headerAccount} className="button header-account"
              onClick={openAccount} aria-haspopup="dialog" disabled={restoring || mutating}
              aria-label={session ? `حساب کاربری ${session.person}` : undefined}>
              {session ? <PersonAvatar name={session.person} /> : <SchedulerIcon name="user" />}
              <span>{session?.person ?? "ورود با پین"}</span>
              {session && <SchedulerIcon name="down" />}
            </button>
          </div>
        </div>
      </header>

      <main id="week-program" className="scheduler-frame scheduler-workspace">
        <div className="week-toolbar">
          <div>
            <h1>برنامهٔ دورکاری تیم</h1>
            <p className="week-date" aria-live="polite">{formatWeekTitle(parseDateKey(weekKey)).replace(/^هفته /, "")}</p>
          </div>
          <nav className="week-navigation" aria-label="ناوبری هفته">
            <button className="button" type="button" disabled={mutating} onClick={() => navigateWeek(-1)}>
              <SchedulerIcon name="right" />هفتهٔ قبل
            </button>
            <button className="button" type="button" disabled={mutating} aria-current={isCurrent ? "true" : undefined}
              onClick={() => navigateWeek(0)}>هفتهٔ جاری</button>
            <button className="button" type="button" disabled={mutating} onClick={() => navigateWeek(1)}>
              هفتهٔ بعد<SchedulerIcon name="left" />
            </button>
          </nav>
        </div>
        <WeekContent key={weekKey} weekKey={weekKey} today={today} session={session} restoring={restoring}
          preference={preference} openAccount={openAccount} runAction={runAction}
          direction={direction} swapsOpen={swapsOpen} setSwapsOpen={setSwapsOpen}
          onPreferenceChange={(value) => {
            setPreference(value);
            savePreference(DAYS_KEY, String(value));
          }} />
      </main>

      {accountOpen && <SchedulerAccount session={session} onClose={closeAccount} onSessionChange={changeSession} />}
    </div>
  );
}
