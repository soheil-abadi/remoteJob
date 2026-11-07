import { Suspense } from "react";
import { connection } from "next/server";
import WeekScheduler from "@/components/WeekScheduler";
import { getWeekStart, toDateKey } from "@/lib/week";

async function SchedulerLoader() {
  await connection();
  const initialWeekStart = toDateKey(getWeekStart(new Date()));
  return <WeekScheduler initialWeekStart={initialWeekStart} />;
}

function SchedulerFallback() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-2">
        <p className="text-4xl font-black tracking-tight text-[var(--ink)] sm:text-5xl">
          دورکار
        </p>
        <p className="text-sm text-[var(--muted)]">در حال بارگذاری هفته…</p>
      </div>
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]/90">
        <div className="grid grid-cols-1 divide-y divide-[var(--line)] md:grid-cols-5 md:divide-x md:divide-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="day-lane">
              <div className="skeleton-block h-5 w-16" />
              <div className="skeleton-block h-4 w-20" />
              <div className="mt-2 flex flex-col gap-2">
                <div className="skeleton-block h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={<SchedulerFallback />}>
        <SchedulerLoader />
      </Suspense>
    </main>
  );
}
