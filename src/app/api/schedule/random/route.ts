import { NextRequest, NextResponse } from "next/server";
import { checkEditPassword } from "@/lib/auth";
import { upsertSchedule } from "@/lib/db/store";
import type { DaysPerPerson } from "@/lib/people";
import { isDaysPerPerson } from "@/lib/people";
import {
  generateRandomAssignments,
  parseDateKey,
  toDateKey,
} from "@/lib/week";

function isValidWeekStart(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateKey(value);
  return toDateKey(date) === value && date.getDay() === 6;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStart, password, daysPerPerson } = body as {
      weekStart?: string;
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

    const assignments = generateRandomAssignments(daysPerPerson);
    const row = await upsertSchedule(weekStart, assignments, daysPerPerson);
    return NextResponse.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
