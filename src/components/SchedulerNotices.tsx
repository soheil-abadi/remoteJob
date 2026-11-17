"use client";

import { useState } from "react";
import { formatJalaliShort, toPersianDigits } from "@/lib/week";
import type { WorkDay } from "@/lib/people";
import {
  errorMessage,
  postJson,
  useSchedulerResource,
  type DayChangeNotice,
  type NoticeLists,
  type RunWeekAction,
  type Session,
} from "./scheduler-client";

function formatDays(days: WorkDay[], workDates: Record<WorkDay, Date>) {
  return days.map((day) => `${day} (${formatJalaliShort(workDates[day])})`).join("، ");
}

export function SchedulerNotices({
  session,
  weekKey,
  workDates,
  runAction,
}: {
  session: Session;
  weekKey: string;
  workDates: Record<WorkDay, Date>;
  runAction: RunWeekAction;
}) {
  const noticesUrl =
    `/api/notices?weekStart=${encodeURIComponent(weekKey)}&pin=${encodeURIComponent(session.pin)}`;
  const resource = useSchedulerResource<NoticeLists>(noticesUrl, "بارگذاری اعلان‌ها انجام نشد.");
  const [pending, setPending] = useState(false);
  const notices = resource.result.status === "ready" ? resource.result.data.notices : [];
  const unread = notices.filter((notice) => !notice.readAt);
  const unreadIds = unread.map((notice) => notice.id);

  async function markRead(ids: number[]) {
    if (!ids.length || pending) return;
    const fallback = "علامت‌گذاری اعلان انجام نشد.";
    setPending(true);
    try {
      await runAction(() =>
        postJson("/api/notices/read", { pin: session.pin, ids, weekStart: weekKey }, fallback),
      );
      if (resource.result.status === "ready") {
        const readAt = new Date().toISOString();
        resource.replace({
          notices: resource.result.data.notices.map((notice) =>
            ids.includes(notice.id) ? { ...notice, readAt } : notice,
          ),
        });
      } else {
        resource.reload();
      }
    } catch (error) {
      console.error(errorMessage(error, fallback));
      resource.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="notices-section" aria-labelledby="notices-title">
      <div className="notices-heading">
        <h2 id="notices-title">اعلان‌های تغییر روز</h2>
        {unread.length > 0 && (
          <span className="count-badge" aria-label={`${toPersianDigits(unread.length)} اعلان خوانده‌نشده`}>
            {toPersianDigits(unread.length)}
          </span>
        )}
        {unread.length > 0 && (
          <button
            className="button"
            type="button"
            disabled={pending}
            onClick={() => void markRead(unreadIds)}
          >
            همه را خواندم
          </button>
        )}
      </div>

      {resource.result.status === "loading" && (
        <p className="muted" role="status">در حال بارگذاری اعلان‌ها…</p>
      )}
      {resource.result.status === "error" && (
        <div className="status-actions">
          <p className="feedback feedback-error" role="alert">{resource.result.message}</p>
          <button className="button" type="button" onClick={() => resource.reload()}>
            تلاش دوباره برای اعلان‌ها
          </button>
        </div>
      )}
      {resource.result.status === "ready" && !notices.length && (
        <p className="muted">اعلانی برای این هفته ندارید.</p>
      )}
      {notices.length > 0 && (
        <ul className="notice-list">
          {notices.map((notice: DayChangeNotice) => (
            <li className="notice-row" key={notice.id} data-unread={!notice.readAt || undefined}>
              <p>
                روزهای شما توسط <strong>{notice.changedBy}</strong> تغییر کرد:
                از <strong>{formatDays(notice.oldDays, workDates)}</strong>
                {" "}به <strong>{formatDays(notice.newDays, workDates)}</strong>.
              </p>
              {!notice.readAt && (
                <button
                  className="button"
                  type="button"
                  disabled={pending}
                  onClick={() => void markRead([notice.id])}
                >
                  خواندم
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
