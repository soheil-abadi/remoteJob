"use client";

import { useRef, useState, type FormEvent, type MouseEventHandler } from "react";
import { PEOPLE, WORK_DAYS, type Assignments, type Person, type WorkDay } from "@/lib/people";
import { formatJalaliShort, getWorkDates, toPersianDigits, validateSwapProposal } from "@/lib/week";
import { PersonAvatar, SchedulerIcon } from "./SchedulerCalendar";
import { gsap, useSchedulerMotion } from "./scheduler-motion";
import {
  errorMessage, postJson, RequestError, useSchedulerResource, type Feedback,
  type RunWeekAction, type Schedule, type Session, type SwapLists,
} from "./scheduler-client";

type Action = "approve" | "reject" | "cancel";
type SwapResult = { schedule?: Schedule };

const actionMessages = {
  approve: "جابه‌جایی تأیید شد و برنامه به‌روز شد.",
  reject: "درخواست رد شد.",
  cancel: "درخواست لغو شد.",
};

export function SwapHeader({
  expanded, onToggle, onNewRequest, count = 0, guest = false, disabled = false,
}: {
  expanded: boolean;
  onToggle: () => void;
  onNewRequest: MouseEventHandler<HTMLButtonElement>;
  count?: number;
  guest?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="swap-section-bar">
      <h2 id="swaps-title">
        <button type="button" className="swap-disclosure" onClick={onToggle}
          aria-expanded={expanded} aria-controls="swap-content">
          درخواست‌های جابه‌جایی
          {count > 0 && <span className="count-badge" aria-label={`${toPersianDigits(count)} درخواست دریافتی`}>
            {toPersianDigits(count)}
          </span>}
        </button>
      </h2>
      <button className="button button-primary" type="button" onClick={onNewRequest}
        aria-haspopup={guest ? "dialog" : undefined} disabled={disabled}>
        <SchedulerIcon name="plus" />
        درخواست جدید
      </button>
    </div>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <p className={`feedback feedback-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
      {feedback.message}
    </p>
  );
}

function SwapComposer({
  assignments, session, weekStart, myDays, busy, onSend, feedback, clearFeedback,
}: {
  assignments: Assignments;
  session: Session;
  weekStart: Date;
  myDays: WorkDay[];
  busy: boolean;
  onSend: (proposal: { fromDay: WorkDay; toPerson: Person; toDay: WorkDay }) => Promise<boolean>;
  feedback: Feedback | null;
  clearFeedback: () => void;
}) {
  const [day, setDay] = useState<WorkDay | "">("");
  const [colleague, setColleague] = useState<Person | "">("");
  const [targetDay, setTargetDay] = useState<WorkDay | "">("");
  const workDates = getWorkDates(weekStart);
  const preview = useRef<HTMLDListElement>(null);

  const fromDay = myDays.length === 1 ? myDays[0] : myDays.find((value) => value === day) ?? "";
  const options = fromDay ? PEOPLE.flatMap((name) => {
    const days = WORK_DAYS.filter((toDay) =>
      validateSwapProposal(assignments, session.person, name, fromDay, toDay).ok);
    return days.length ? [{ name, days }] : [];
  }) : [];
  const selected = options.find(({ name }) => name === colleague);
  const toDay = selected?.days.find((value) => value === targetDay) ?? "";
  const dayLabel = (value: WorkDay) => `${value}، ${formatJalaliShort(workDates[value])}`;

  useSchedulerMotion(() => {
    if (!preview.current) return;
    gsap.fromTo(preview.current, { opacity: .67, y: 7 }, {
      opacity: 1, y: 0, duration: .22, ease: "power2.out", clearProps: "transform,opacity",
    });
  }, [fromDay, selected?.name, toDay]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromDay || !selected || !toDay || busy) return;
    if (await onSend({ fromDay, toPerson: selected.name, toDay })) {
      setColleague("");
      setTargetDay("");
      setDay("");
    }
  }

  return (
    <form className="swap-card swap-composer" onSubmit={(event) => void submit(event)} onChange={clearFeedback}>
      <h3 tabIndex={-1}>درخواست جدید</h3>
      {myDays.length ? <>
        <fieldset className="swap-fields" disabled={busy}>
          <div className="form-field">
            <label htmlFor="swap-from">روز شما</label>
            <select className="control" id="swap-from" value={fromDay} onChange={(event) => {
              setDay(event.target.value as WorkDay | "");
              setColleague("");
              setTargetDay("");
            }}>
              {!fromDay && <option value="">انتخاب روز شما</option>}
              {myDays.map((value) => <option value={value} key={value}>{dayLabel(value)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="swap-colleague">همکار</label>
            <select className="control" id="swap-colleague" value={selected?.name ?? ""}
              disabled={!options.length} onChange={(event) => {
                setColleague(event.target.value as Person | "");
                setTargetDay("");
              }}>
              <option value="">انتخاب همکار</option>
              {options.map(({ name }) => <option value={name} key={name}>{name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="swap-to">روز همکار</label>
            <select className="control" id="swap-to" value={toDay} disabled={!selected}
              onChange={(event) => setTargetDay(event.target.value as WorkDay | "")}>
              <option value="">انتخاب روز همکار</option>
              {selected?.days.map((value) => <option value={value} key={value}>{dayLabel(value)}</option>)}
            </select>
          </div>
        </fieldset>
        {fromDay && !options.length && (
          <p className="muted">برای {fromDay} امکان جابه‌جایی با همکاران وجود ندارد.</p>
        )}
        {fromDay && selected && toDay && (
          <dl ref={preview} className="swap-preview">
            <div><dt>روز جدید شما</dt><dd>{dayLabel(toDay)}</dd></div>
            <div><dt>روز جدید {selected.name}</dt><dd>{dayLabel(fromDay)}</dd></div>
          </dl>
        )}
        <FeedbackLine feedback={feedback} />
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={busy || !selected || !toDay}>
            ارسال درخواست
          </button>
        </div>
      </> : <p className="muted">برای شما روز دورکاری در این هفته ثبت نشده است.</p>}
    </form>
  );
}

export function SchedulerSwaps({
  session, assignments, myDays, weekKey, weekStart, runAction, onScheduleChange, onScheduleConflict,
  expanded, onExpand, onToggle,
}: {
  session: Session;
  assignments: Assignments | null;
  myDays: WorkDay[];
  weekKey: string;
  weekStart: Date;
  runAction: RunWeekAction;
  onScheduleChange: (schedule: Schedule) => void;
  onScheduleConflict: () => void;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
}) {
  const swapUrl = `/api/swaps?weekStart=${encodeURIComponent(weekKey)}&pin=${encodeURIComponent(session.pin)}`;
  const swaps = useSchedulerResource<SwapLists>(swapUrl, "بارگذاری درخواست‌ها انجام نشد.");
  const [pending, setPending] = useState<number | "send" | null>(null);
  const [composerFeedback, setComposerFeedback] = useState<Feedback | null>(null);
  const [requestFeedback, setRequestFeedback] = useState<(Feedback & { id: number }) | null>(null);
  const requestsHeading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lists = swaps.result.status === "ready" ? swaps.result.data : null;
  const hasRequests = Boolean(lists && (lists.incoming.length || lists.outgoing.length));
  const inlineRequestError = requestFeedback?.kind === "error" && lists &&
    [...lists.incoming, ...lists.outgoing].some((item) => item.id === requestFeedback.id);
  const busy = pending !== null;

  useSchedulerMotion(() => {
    if (!expanded || !panel.current) return;
    gsap.fromTo(panel.current, { opacity: .7, y: 8 }, {
      opacity: 1, y: 0, duration: .28, ease: "power2.out", clearProps: "transform,opacity",
    });
  }, [expanded]);

  function newRequest() {
    onExpand();
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(".swap-composer h3")?.focus());
  }

  async function send(proposal: { fromDay: WorkDay; toPerson: Person; toDay: WorkDay }) {
    const fallback = "درخواست ارسال نشد. دوباره تلاش کنید.";
    setPending("send");
    setComposerFeedback(null);
    try {
      await runAction(() => postJson("/api/swaps", { ...proposal, weekStart: weekKey, pin: session.pin }, fallback));
      setComposerFeedback({ kind: "success", message: `درخواست برای ${proposal.toPerson} ارسال شد.` });
      swaps.reload();
      return true;
    } catch (error) {
      setComposerFeedback({ kind: "error", message: errorMessage(error, fallback) });
      return false;
    } finally {
      setPending(null);
    }
  }

  async function respond(id: number, action: Action) {
    const fallback = "این اقدام انجام نشد. دوباره تلاش کنید.";
    setPending(id);
    setRequestFeedback(null);
    try {
      const result = await runAction(() => postJson<SwapResult>(`/api/swaps/${id}`, { action, pin: session.pin }, fallback));
      if (result.schedule) onScheduleChange(result.schedule);
      setRequestFeedback({ id, kind: "success", message: actionMessages[action] });
      requestsHeading.current?.focus();
      swaps.reload();
    } catch (error) {
      setRequestFeedback({ id, kind: "error", message: errorMessage(error, fallback) });
      if (error instanceof RequestError && error.status === 409) {
        onScheduleConflict();
        requestsHeading.current?.focus();
        swaps.reload();
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <SwapHeader expanded={expanded} onToggle={onToggle} onNewRequest={newRequest}
        count={lists?.incoming.length} />
      <div ref={panel} id="swap-content" hidden={!expanded}>
        <div className="swap-columns">
          <div className="swap-card swap-inbox">
            <div className="inbox-heading">
              <h3 ref={requestsHeading} tabIndex={-1}>درخواست‌های دریافتی</h3>
              {lists && lists.incoming.length > 0 && <span className="count-badge">{toPersianDigits(lists.incoming.length)}</span>}
            </div>
            {!inlineRequestError && <FeedbackLine feedback={requestFeedback} />}
            {swaps.result.status === "loading" && <p className="muted" role="status">در حال بارگذاری درخواست‌ها…</p>}
            {swaps.result.status === "error" && (
              <div className="status-actions">
                <p className="feedback feedback-error" role="alert">{swaps.result.message}</p>
                <button className="button" type="button" onClick={() => {
                  requestsHeading.current?.focus();
                  swaps.reload();
                }}>تلاش دوباره برای درخواست‌ها</button>
              </div>
            )}
            {lists && <>
              {!lists.incoming.length && (
                <p className="muted">{hasRequests ? "درخواستی برای پاسخ ندارید." : "درخواست بازی برای این هفته ندارید."}</p>
              )}
              {lists.incoming.length > 0 && (
                <ul className="request-list">
                  {lists.incoming.map((item) => (
                    <li className="request-row" key={item.id}>
                      <div className="request-person">
                        <PersonAvatar name={item.fromPerson} /><strong>{item.fromPerson}</strong>
                      </div>
                      <p>روز شما پس از جابه‌جایی <strong>{item.fromDay}</strong> می‌شود و روز {item.fromPerson} به <strong>{item.toDay}</strong> تغییر می‌کند.</p>
                      {inlineRequestError && requestFeedback?.id === item.id && <FeedbackLine feedback={requestFeedback} />}
                      <div className="form-actions">
                        <button className="button button-primary" type="button" disabled={busy || !assignments}
                          onClick={() => void respond(item.id, "approve")}>تأیید جابه‌جایی</button>
                        <button className="button" type="button" disabled={busy}
                          onClick={() => void respond(item.id, "reject")}>رد درخواست</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {lists.outgoing.length > 0 && (
                <div className="outgoing-requests">
                  <h3>درخواست‌های ارسالی</h3>
                  <ul className="request-list">
                    {lists.outgoing.map((item) => (
                      <li className="request-row" key={item.id}>
                        <div className="request-person">
                          <PersonAvatar name={item.toPerson} /><strong>{item.toPerson}</strong>
                          <span className="pending-tag">در انتظار پاسخ</span>
                        </div>
                        <p>روز شما از <strong>{item.fromDay}</strong> به <strong>{item.toDay}</strong> تغییر می‌کند.</p>
                        {inlineRequestError && requestFeedback?.id === item.id && <FeedbackLine feedback={requestFeedback} />}
                        <div>
                          <button className="button" type="button" disabled={busy}
                            onClick={() => void respond(item.id, "cancel")}>لغو درخواست</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>}
          </div>

          {assignments ? (
            <SwapComposer assignments={assignments} session={session} weekStart={weekStart}
              myDays={myDays} onSend={send} busy={busy} feedback={composerFeedback}
              clearFeedback={() => setComposerFeedback(null)} />
          ) : (
            <div className="swap-card swap-composer">
              <h3 tabIndex={-1}>درخواست جدید</h3>
              <p className="muted">با آماده شدن برنامهٔ هفته می‌توانید درخواست جابه‌جایی بفرستید.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
