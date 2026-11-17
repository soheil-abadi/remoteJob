import { NextRequest, NextResponse } from "next/server";
import { personFromPin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pin = (body as { pin?: unknown }).pin;
    const person = await personFromPin(pin);
    if (!person) {
      return NextResponse.json({ error: "پین نادرست است." }, { status: 401 });
    }
    return NextResponse.json({ person });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
