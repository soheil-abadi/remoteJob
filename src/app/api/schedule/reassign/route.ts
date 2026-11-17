import { NextRequest, NextResponse } from "next/server";
import { isPerson, personFromPin } from "@/lib/auth";
import {
  createDayChangeNotices,
  getSchedule,
  upsertSchedule,
} from "@/lib/db/store";
import { WORK_DAYS, type WorkDay } from "@/lib/people";
import { isScheduleAdmin } from "@/lib/schedule-admin";
import { isValidWeekStart, reassignPersonDays } from "@/lib/week";

function isWorkDayList(value: unknown): value is WorkDay[] {
  return (
    Array.isArray(value) &&
    value.every((day) => typeof day === "string" && WORK_DAYS.includes(day as WorkDay))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStart, pin, person, days } = body as {
      weekStart?: string;
      pin?: string;
      person?: unknown;
      days?: unknown;
    };

    const admin = await personFromPin(pin);
    if (!admin) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }
    if (!isScheduleAdmin(admin)) {
      return NextResponse.json(
        { error: "فقط مدیران برنامه می‌توانند روزها را تغییر دهند." },
        { status: 403 },
      );
    }

    if (!weekStart || !isValidWeekStart(weekStart)) {
      return NextResponse.json(
        { error: "weekStart نامعتبر است." },
        { status: 400 },
      );
    }
    if (!isPerson(person)) {
      return NextResponse.json({ error: "نام همکار نامعتبر است." }, { status: 400 });
    }
    if (!isWorkDayList(days)) {
      return NextResponse.json({ error: "لیست روزها نامعتبر است." }, { status: 400 });
    }

    const existing = await getSchedule(weekStart);
    if (!existing) {
      return NextResponse.json(
        { error: "برنامهٔ این هفته هنوز منتشر نشده است." },
        { status: 404 },
      );
    }

    const result = reassignPersonDays(
      existing.assignments,
      person,
      days,
      existing.daysPerPerson,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const row = await upsertSchedule(
      weekStart,
      result.assignments,
      existing.daysPerPerson,
    );

    const notices = await createDayChangeNotices(
      result.changes.map((change) => ({
        weekStart,
        person: change.person,
        changedBy: admin,
        oldDays: change.oldDays,
        newDays: change.newDays,
      })),
    );

    return NextResponse.json({
      weekStart: row.weekStart,
      assignments: row.assignments,
      daysPerPerson: row.daysPerPerson,
      updatedAt: row.updatedAt,
      notices,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
