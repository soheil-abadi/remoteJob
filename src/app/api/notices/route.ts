import { NextRequest, NextResponse } from "next/server";
import { personFromPin } from "@/lib/auth";
import { listDayChangeNoticesForPerson } from "@/lib/db/store";
import { isValidWeekStart } from "@/lib/week";

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get("weekStart");
    const pin = request.nextUrl.searchParams.get("pin");

    const person = await personFromPin(pin);
    if (!person) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }
    if (!weekStart || !isValidWeekStart(weekStart)) {
      return NextResponse.json(
        { error: "weekStart نامعتبر است." },
        { status: 400 },
      );
    }

    const notices = await listDayChangeNoticesForPerson({ weekStart, person });
    return NextResponse.json({
      notices: notices.map((notice) => ({
        id: notice.id,
        weekStart: notice.weekStart,
        person: notice.person,
        changedBy: notice.changedBy,
        oldDays: notice.oldDays,
        newDays: notice.newDays,
        readAt: notice.readAt,
        createdAt: notice.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
