import { NextRequest, NextResponse } from "next/server";
import { personFromPin } from "@/lib/auth";
import { markDayChangeNoticesRead } from "@/lib/db/store";
import { isValidWeekStart } from "@/lib/week";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, ids, weekStart } = body as {
      pin?: string;
      ids?: unknown;
      weekStart?: string;
    };

    const person = await personFromPin(pin);
    if (!person) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }

    const noticeIds = Array.isArray(ids)
      ? ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id))
      : undefined;

    if (weekStart !== undefined && !isValidWeekStart(weekStart)) {
      return NextResponse.json(
        { error: "weekStart نامعتبر است." },
        { status: 400 },
      );
    }

    if (!noticeIds?.length && !weekStart) {
      return NextResponse.json(
        { error: "باید ids یا weekStart مشخص شود." },
        { status: 400 },
      );
    }

    const updated = await markDayChangeNoticesRead({
      person,
      ids: noticeIds,
      weekStart,
    });

    return NextResponse.json({ updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
