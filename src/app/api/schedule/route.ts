import { NextRequest, NextResponse } from "next/server";
import { checkEditPassword } from "@/lib/auth";
import { getSchedule, upsertSchedule } from "@/lib/db/store";
import type { Assignments, DaysPerPerson } from "@/lib/people";
import { WORK_DAYS, isDaysPerPerson } from "@/lib/people";
import { parseDateKey, toDateKey, validateAssignments } from "@/lib/week";

function isValidWeekStart(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateKey(value);
  return toDateKey(date) === value && date.getDay() === 6;
}

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get("weekStart");
    if (!isValidWeekStart(weekStart)) {
      return NextResponse.json(
        {
          error:
            "پارامتر weekStart نامعتبر است (باید شنبه به صورت YYYY-MM-DD باشد).",
        },
        { status: 400 },
      );
    }

    const row = await getSchedule(weekStart);
    if (!row) {
      return NextResponse.json({
        weekStart,
        assignments: null,
        daysPerPerson: null,
      });
    }

    return NextResponse.json({
      weekStart: row.weekStart,
      assignments: row.assignments,
      daysPerPerson: row.daysPerPerson,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStart, assignments, password, daysPerPerson } = body as {
      weekStart?: string;
      assignments?: Assignments;
      password?: string;
      daysPerPerson?: DaysPerPerson;
    };

    if (!checkEditPassword(password)) {
      return NextResponse.json(
        { error: "رمز ویرایش نادرست است." },
        { status: 401 },
      );
    }

    if (!weekStart || !isValidWeekStart(weekStart)) {
      return NextResponse.json(
        { error: "weekStart نامعتبر است." },
        { status: 400 },
      );
    }

    if (!isDaysPerPerson(daysPerPerson)) {
      return NextResponse.json(
        { error: "daysPerPerson باید ۱ یا ۲ باشد." },
        { status: 400 },
      );
    }

    if (!assignments || typeof assignments !== "object") {
      return NextResponse.json(
        { error: "assignments الزامی است." },
        { status: 400 },
      );
    }

    for (const day of WORK_DAYS) {
      if (!Array.isArray(assignments[day])) {
        return NextResponse.json(
          { error: `روز ${day} در assignments نامعتبر است.` },
          { status: 400 },
        );
      }
    }

    const validation = validateAssignments(assignments, daysPerPerson);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const row = await upsertSchedule(weekStart, assignments, daysPerPerson);
    return NextResponse.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
