import { PEOPLE, type Person } from "./people";
import { getPersonPinOverrides, upsertPersonPin } from "./db/store";

export { SCHEDULE_ADMINS, isScheduleAdmin } from "./schedule-admin";

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

type PinMap = Record<string, string>;

function normalizeName(value: string): string {
  return value.normalize("NFC").trim();
}

function pinValue(value: unknown): string | null {
  if (typeof value === "string") {
    const pin = value.trim();
    return pin.length > 0 ? pin : null;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

/** Unwrap common Vercel/dashboard quote mistakes around the whole JSON blob. */
function normalizePersonPinsRaw(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function resolvePersonName(name: string): Person | null {
  const normalized = normalizeName(name);
  return PEOPLE.find((person) => normalizeName(person) === normalized) ?? null;
}

function parsePersonPins(): PinMap {
  const raw = process.env.PERSON_PINS;
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(normalizePersonPinsRaw(raw)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.error("PERSON_PINS must be a JSON object of name → pin.");
      return {};
    }
    const map: PinMap = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      const person = resolvePersonName(name);
      const pin = pinValue(value);
      if (!person || !pin) continue;
      map[person] = pin;
    }
    if (Object.keys(map).length === 0) {
      console.error("PERSON_PINS parsed but matched no known people/pins.");
    }
    return map;
  } catch (error) {
    console.error("PERSON_PINS is not valid JSON.", error);
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
  // Empty/whitespace PERSON_PINS still counts as unset for local defaults.
  if (!process.env.PERSON_PINS?.trim()) return defaultDevPins();
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
