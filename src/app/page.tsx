import { Suspense } from "react";
import { connection } from "next/server";
import WeekScheduler from "@/components/WeekScheduler";
import { CalendarSkeleton, SchedulerBrand } from "@/components/SchedulerCalendar";
import { getWeekStart, toDateKey } from "@/lib/week";

async function SchedulerLoader() {
  await connection();
  const today = new Date();
  return <WeekScheduler initialWeekStart={toDateKey(getWeekStart(today))} initialToday={toDateKey(today)} />;
}

function SchedulerFallback() {
  return (
    <div className="scheduler-shell" aria-busy="true">
      <header className="scheduler-header">
        <div className="scheduler-frame scheduler-header-inner"><SchedulerBrand /></div>
      </header>
      <main className="scheduler-frame scheduler-workspace">
        <div className="week-toolbar">
          <div>
            <h1>برنامهٔ دورکاری تیم</h1>
            <p className="week-date" role="status">در حال بارگذاری هفته…</p>
          </div>
        </div>
        <section className="calendar-panel" aria-labelledby="calendar-title">
          <h2 id="calendar-title" className="sr-only">تقویم هفته</h2>
          <CalendarSkeleton />
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<SchedulerFallback />}>
      <SchedulerLoader />
    </Suspense>
  );
}
