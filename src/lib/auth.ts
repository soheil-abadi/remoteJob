import { PEOPLE, type Person } from "./people";
import { getPersonPinOverrides, upsertPersonPin } from "./db/store";

export const SCHEDULE_ADMIN: Person = "سهیل";

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

type PinMap = Record<string, string>;

function parsePersonPins(): PinMap {
  const raw = process.env.PERSON_PINS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const map: PinMap = {};
    for (const [name, pin] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof pin === "string" && pin.length > 0) {
        map[name] = pin;
      }
    }
    return map;
  } catch {
    return {};
  }
}

/** Dev convenience: when PERSON_PINS is unset, map each person to a fixed PIN. */
function defaultDevPins(): PinMap {
  const map: PinMap = {};
  PEOPLE.forEach((person, index) => {
    map[person] = String(1000 + index);
  });
  return map;
}

function basePinMap(): PinMap {
  const configured = parsePersonPins();
  if (Object.keys(configured).length > 0) return configured;
  if (!process.env.PERSON_PINS) return defaultDevPins();
  return {};
}

async function effectivePinMap(): Promise<PinMap> {
  const map: PinMap = { ...basePinMap() };
  const overrides = await getPersonPinOverrides();
  for (const person of PEOPLE) {
    if (overrides[person]) {
      map[person] = overrides[person];
    }
  }
  return map;
}

export function isPerson(value: unknown): value is Person {
  return typeof value === "string" && PEOPLE.includes(value as Person);
}

export function isValidPinFormat(pin: unknown): pin is string {
  return (
    typeof pin === "string" &&
    pin.length >= MIN_PIN_LENGTH &&
    pin.length <= MAX_PIN_LENGTH &&
    /^\d+$/.test(pin)
  );
}

/**
 * Resolve a PIN to a person. Pins must be unique across people.
 * Returns null when the PIN is unknown or ambiguous.
 */
export async function personFromPin(pin: unknown): Promise<Person | null> {
  if (typeof pin !== "string" || pin.length === 0) return null;
  const map = await effectivePinMap();
  const matches: Person[] = [];
  for (const person of PEOPLE) {
    if (map[person] === pin) matches.push(person);
  }
  if (matches.length !== 1) return null;
  return matches[0];
}

export function isScheduleAdmin(person: Person): boolean {
  return person === SCHEDULE_ADMIN;
}

export type ChangePinResult =
  | { ok: true; person: Person; pin: string }
  | { ok: false; error: string; status: number };

export async function changePersonPin(input: {
  currentPin: unknown;
  newPin: unknown;
}): Promise<ChangePinResult> {
  const person = await personFromPin(input.currentPin);
  if (!person) {
    return { ok: false, error: "پین فعلی نادرست است.", status: 401 };
  }

  if (!isValidPinFormat(input.newPin)) {
    return {
      ok: false,
      error: `پین جدید باید ${MIN_PIN_LENGTH} تا ${MAX_PIN_LENGTH} رقم باشد.`,
      status: 400,
    };
  }

  const newPin = input.newPin;
  if (newPin === input.currentPin) {
    return {
      ok: false,
      error: "پین جدید باید با پین فعلی فرق داشته باشد.",
      status: 400,
    };
  }

  const map = await effectivePinMap();
  for (const name of PEOPLE) {
    if (name !== person && map[name] === newPin) {
      return {
        ok: false,
        error: "این پین قبلاً توسط کس دیگری استفاده شده است.",
        status: 409,
      };
    }
  }

  await upsertPersonPin(person, newPin);
  return { ok: true, person, pin: newPin };
}
