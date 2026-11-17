"use client";

import { useEffect, useState } from "react";
import type { Assignments, DaysPerPerson, Person, WorkDay } from "@/lib/people";

export type Session = { person: Person; pin: string };

export type Schedule = {
  assignments: Assignments | null;
  daysPerPerson: DaysPerPerson | null;
};

export type SwapRequest = {
  id: number;
  fromPerson: string;
  toPerson: string;
  fromDay: WorkDay;
  toDay: WorkDay;
};

export type SwapLists = { incoming: SwapRequest[]; outgoing: SwapRequest[] };

export type DayChangeNotice = {
  id: number;
  weekStart: string;
  person: string;
  changedBy: string;
  oldDays: WorkDay[];
  newDays: WorkDay[];
  readAt: string | null;
  createdAt: string;
};

export type NoticeLists = { notices: DayChangeNotice[] };

type Resource<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export type RunWeekAction = <T>(action: () => Promise<T>) => Promise<T>;

export class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requestJson<T>(
  url: string,
  fallback: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new RequestError(fallback, 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = response.status < 500 && typeof data?.error === "string"
      ? data.error
      : fallback;
    throw new RequestError(message, response.status);
  }
  return data;
}

export function postJson<T>(url: string, body: object, fallback: string, signal?: AbortSignal) {
  return requestJson<T>(url, fallback, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export type Feedback = { kind: "error" | "success"; message: string };

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof RequestError ? error.message : fallback;
}

export function useSchedulerResource<T>(url: string, fallback: string) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    url: string;
    revision: number;
    result: Resource<T>;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    function publish(result: Resource<T>) {
      if (!controller.signal.aborted) setSnapshot({ url, revision, result });
    }

    void requestJson<T>(url, fallback, { signal: controller.signal }).then(
      (data) => publish({ status: "ready", data }),
      (error: unknown) => publish({ status: "error", message: errorMessage(error, fallback) }),
    );
    return () => controller.abort();
  }, [url, fallback, revision]);

  const result: Resource<T> = snapshot?.url === url && snapshot.revision === revision
    ? snapshot.result
    : { status: "loading" };

  return {
    result,
    reload: () => setRevision((value) => value + 1),
    replace: (data: T) => setSnapshot({ url, revision, result: { status: "ready", data } }),
  };
}

export function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function savePreference(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}
