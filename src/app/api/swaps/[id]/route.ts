import { NextRequest, NextResponse } from "next/server";
import { personFromPin } from "@/lib/auth";
import {
  getSchedule,
  getSwapRequest,
  updateSwapStatus,
  upsertSchedule,
} from "@/lib/db/store";
import {
  applySwap,
  validateAssignments,
  validateSwapProposal,
} from "@/lib/week";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "شناسه نامعتبر است." }, { status: 400 });
    }

    const body = await request.json();
    const { pin, action } = body as {
      pin?: string;
      action?: "approve" | "reject" | "cancel";
    };

    const person = await personFromPin(pin);
    if (!person) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }

    if (action !== "approve" && action !== "reject" && action !== "cancel") {
      return NextResponse.json(
        { error: "اقدام نامعتبر است." },
        { status: 400 },
      );
    }

    const swap = await getSwapRequest(id);
    if (!swap) {
      return NextResponse.json(
        { error: "درخواست پیدا نشد." },
        { status: 404 },
      );
    }
    if (swap.status !== "pending") {
      return NextResponse.json(
        { error: "این درخواست دیگر در انتظار نیست." },
        { status: 409 },
      );
    }

    if (action === "cancel") {
      if (swap.fromPerson !== person) {
        return NextResponse.json(
          { error: "فقط فرستنده می‌تواند درخواست را لغو کند." },
          { status: 403 },
        );
      }
      const updated = await updateSwapStatus(id, "cancelled");
      return NextResponse.json({ swap: updated });
    }

    if (swap.toPerson !== person) {
      return NextResponse.json(
        { error: "فقط گیرنده می‌تواند پاسخ دهد." },
        { status: 403 },
      );
    }

    if (action === "reject") {
      const updated = await updateSwapStatus(id, "rejected");
      return NextResponse.json({ swap: updated });
    }

    const schedule = await getSchedule(swap.weekStart);
    if (!schedule) {
      return NextResponse.json(
        { error: "برنامهٔ این هفته پیدا نشد." },
        { status: 400 },
      );
    }

    const stillValid = validateSwapProposal(
      schedule.assignments,
      swap.fromPerson,
      swap.toPerson,
      swap.fromDay,
      swap.toDay,
    );
    if (!stillValid.ok) {
      return NextResponse.json(
        {
          error: `جابه‌جایی دیگر ممکن نیست: ${stillValid.error}`,
        },
        { status: 409 },
      );
    }

    const nextAssignments = applySwap(
      schedule.assignments,
      swap.fromPerson,
      swap.toPerson,
      swap.fromDay,
      swap.toDay,
    );
    const validation = validateAssignments(
      nextAssignments,
      schedule.daysPerPerson,
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const row = await upsertSchedule(
      swap.weekStart,
      nextAssignments,
      schedule.daysPerPerson,
    );
    const updated = await updateSwapStatus(id, "approved");
    return NextResponse.json({ swap: updated, schedule: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
