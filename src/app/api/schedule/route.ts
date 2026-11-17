import { NextRequest, NextResponse } from "next/server";
import { getSchedule } from "@/lib/db/store";
import { isValidWeekStart } from "@/lib/week";

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
