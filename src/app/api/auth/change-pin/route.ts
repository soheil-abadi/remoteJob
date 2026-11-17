import { NextRequest, NextResponse } from "next/server";
import { changePersonPin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPin, newPin } = body as {
      currentPin?: unknown;
      newPin?: unknown;
    };

    const result = await changePersonPin({ currentPin, newPin });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      person: result.person,
      pin: result.pin,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
