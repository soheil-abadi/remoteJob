import { NextRequest, NextResponse } from "next/server";
import { personFromPin } from "@/lib/auth";
import { isScheduleAdmin } from "@/lib/schedule-admin";
import { getSchedule, upsertSchedule } from "@/lib/db/store";
import type { DaysPerPerson } from "@/lib/people";
import { isDaysPerPerson } from "@/lib/people";
import {
  generateRandomAssignments,
  isValidWeekStart,
} from "@/lib/week";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStart, pin, daysPerPerson } = body as {
      weekStart?: string;
      pin?: string;
      daysPerPerson?: DaysPerPerson;
    };

    const person = await personFromPin(pin);
    if (!person) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }
    if (!isScheduleAdmin(person)) {
      return NextResponse.json(
        { error: "فقط مدیران برنامه می‌توانند برنامهٔ تصادفی بسازند." },
        { status: 403 },
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

    const existing = await getSchedule(weekStart);
    if (existing) {
      return NextResponse.json(
        {
          error:
            "این هفته از قبل برنامه دارد. برای تغییر باید از دیگران درخواست جابه‌جایی بگیرید.",
        },
        { status: 409 },
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
