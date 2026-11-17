import { NextRequest, NextResponse } from "next/server";
import { personFromPin } from "@/lib/auth";
import {
  createSwapRequest,
  getSchedule,
  listPendingSwapsForPerson,
} from "@/lib/db/store";
import { PEOPLE, WORK_DAYS, type WorkDay } from "@/lib/people";
import {
  isValidWeekStart,
  validateSwapProposal,
} from "@/lib/week";

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get("weekStart");
    const pin = request.nextUrl.searchParams.get("pin");

    if (!isValidWeekStart(weekStart)) {
      return NextResponse.json(
        { error: "weekStart نامعتبر است." },
        { status: 400 },
      );
    }

    const person = await personFromPin(pin);
    if (!person) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }

    const lists = await listPendingSwapsForPerson({ weekStart, person });
    return NextResponse.json(lists);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStart, pin, toPerson, fromDay, toDay } = body as {
      weekStart?: string;
      pin?: string;
      toPerson?: string;
      fromDay?: WorkDay;
      toDay?: WorkDay;
    };

    const fromPerson = await personFromPin(pin);
    if (!fromPerson) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }

    if (!weekStart || !isValidWeekStart(weekStart)) {
      return NextResponse.json(
        { error: "weekStart نامعتبر است." },
        { status: 400 },
      );
    }

    if (
      typeof toPerson !== "string" ||
      !PEOPLE.includes(toPerson as (typeof PEOPLE)[number])
    ) {
      return NextResponse.json(
        { error: "طرف مقابل نامعتبر است." },
        { status: 400 },
      );
    }

    if (
      !fromDay ||
      !toDay ||
      !WORK_DAYS.includes(fromDay) ||
      !WORK_DAYS.includes(toDay)
    ) {
      return NextResponse.json({ error: "روز نامعتبر است." }, { status: 400 });
    }

    const schedule = await getSchedule(weekStart);
    if (!schedule) {
      return NextResponse.json(
        { error: "این هفته هنوز برنامه‌ای ندارد." },
        { status: 400 },
      );
    }

    const validation = validateSwapProposal(
      schedule.assignments,
      fromPerson,
      toPerson,
      fromDay,
      toDay,
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const row = await createSwapRequest({
      weekStart,
      fromPerson,
      toPerson,
      fromDay,
      toDay,
    });
    return NextResponse.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
