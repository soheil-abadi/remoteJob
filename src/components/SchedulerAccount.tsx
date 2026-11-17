"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { Person } from "@/lib/people";
import { PersonAvatar, SchedulerIcon } from "./SchedulerCalendar";
import { gsap, useSchedulerMotion } from "./scheduler-motion";
import { errorMessage, postJson, type Session } from "./scheduler-client";

function PinField({
  id, label, autoComplete, first = false, error,
}: {
  id: string;
  label: string;
  autoComplete: string;
  first?: boolean;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="pin-control">
        <input id={id} name={id} className="control" type={visible ? "text" : "password"}
          inputMode="numeric" autoComplete={autoComplete} dir="ltr" required
          data-initial-focus={first || undefined}
          aria-invalid={Boolean(error) || undefined} aria-describedby={error} />
        <button type="button" className="icon-button pin-visibility" onClick={() => setVisible(!visible)}
          aria-label={visible ? `مخفی کردن ${label}` : `نمایش ${label}`} aria-controls={id}>
          <SchedulerIcon name={visible ? "eye" : "eye-off"} />
        </button>
      </div>
    </div>
  );
}

export function SchedulerAccount({
  session, onClose, onSessionChange,
}: {
  session: Session | null;
  onClose: () => void;
  onSessionChange: (session: Session | null, message: string | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState(session ? "account" : "login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
  }, [view]);

  useSchedulerMotion(() => {
    if (!dialogRef.current?.open) return;
    gsap.fromTo(dialogRef.current, { opacity: .88, y: 13, scale: .985 }, {
      opacity: 1, y: 0, scale: 1, duration: .26, ease: "power2.out", clearProps: "transform,opacity",
    });
  }, []);

  function dismiss() {
    dialogRef.current?.close();
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const readPin = (name: string) => String(form.get(name) ?? "").replace(/\s/g, "");
    const currentPin = readPin("current-pin");
    const newPin = readPin("new-pin");
    const changing = view === "change";

    if (!currentPin || (changing && (!newPin || !readPin("repeat-pin")))) {
      setError(changing ? "همهٔ فیلدهای پین را پر کنید." : "پین شخصی را وارد کنید.");
      return;
    }
    if (changing && newPin !== readPin("repeat-pin")) {
      setError("پین جدید و تکرار آن یکسان نیستند.");
      return;
    }

    const fallback = changing ? "تغییر پین انجام نشد. دوباره تلاش کنید." : "ورود انجام نشد. دوباره تلاش کنید.";
    setBusy(true);
    setError("");
    try {
      if (changing) {
        const updated = await postJson<Session>("/api/auth/change-pin", { currentPin, newPin }, fallback);
        onSessionChange(updated, "پین با موفقیت تغییر کرد.");
      } else {
        const { person } = await postJson<{ person: Person }>("/api/auth/login", { pin: currentPin }, fallback);
        onSessionChange({ person, pin: currentPin }, null);
      }
      dismiss();
    } catch (error) {
      setError(errorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  }

  function showAccount() {
    setError("");
    setView("account");
  }

  return (
    <dialog ref={dialogRef} className="account-dialog" aria-labelledby="account-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) dismiss();
      }}>
      <div className="dialog-heading">
        <h2 id="account-title">{view === "login" ? "ورود به دورکار" : view === "change" ? "تغییر پین" : "حساب کاربری"}</h2>
        <button className="icon-button" type="button" aria-label="بستن" onClick={dismiss} disabled={busy}>
          <SchedulerIcon name="close" />
        </button>
      </div>

      {view === "account" && session ? (
        <div className="account-body">
          <div className="account-identity">
            <PersonAvatar name={session.person} />
            <strong>{session.person}</strong>
          </div>
          <button type="button" className="button" data-initial-focus onClick={() => setView("change")}>
            تغییر پین
          </button>
          <button type="button" className="button button-danger" onClick={() => {
            onSessionChange(null, "از حساب خارج شدید.");
            dismiss();
          }}>
            خروج از حساب
          </button>
        </div>
      ) : (
        <form key={view} className="account-body" onSubmit={(event) => void submit(event)}
          onChange={() => setError("")} aria-busy={busy} noValidate>
          <p className="muted">
            {view === "change"
              ? "پین جدید باید ۴ تا ۱۲ رقم باشد."
              : "برای دیدن روزهای خودتان و جابه‌جایی با همکاران، پین شخصی‌تان را وارد کنید."}
          </p>
          <fieldset disabled={busy} className="pin-fields">
            <PinField id="current-pin" label={view === "change" ? "پین فعلی" : "پین شخصی"}
              autoComplete="current-password" first error={view === "login" && error ? "pin-error" : undefined} />
            {view === "change" && <>
              <PinField id="new-pin" label="پین جدید" autoComplete="new-password" />
              <PinField id="repeat-pin" label="تکرار پین جدید" autoComplete="new-password" />
            </>}
          </fieldset>
          {error && <p id="pin-error" className="feedback feedback-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? "در حال بررسی…" : view === "change" ? "ذخیرهٔ پین جدید" : "ورود"}
            </button>
            {view === "change" && <button type="button" className="button" onClick={showAccount} disabled={busy}>بازگشت</button>}
          </div>
        </form>
      )}
    </dialog>
  );
}
