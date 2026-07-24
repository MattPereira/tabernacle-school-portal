"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

// The contract every admin form shares. It lives here rather than beside the
// actions because the form owns it: an action's job is to answer in terms the
// screen can render — a sentence to show, or nothing.
export type AdminActionState = { error: string } | { notice: string } | null;

export type AdminAction = (
  state: AdminActionState,
  form: FormData,
) => Promise<AdminActionState>;

// Wraps a server action so its answer lands next to the form that asked, rather
// than replacing the page. Presentational: it renders whatever the action said
// and decides nothing.
export function AdminForm({ action, children }: { action: AdminAction; children: ReactNode }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction}>
      {children}
      {state && "error" in state && <p role="alert">⚠ {state.error}</p>}
      {state && "notice" in state && <p role="status">✓ {state.notice}</p>}
    </form>
  );
}

// A submit button that knows its own form is busy — sync takes tens of seconds
// against the real FACTS rate limit, and a button that looks idle invites a
// second click.
export function SubmitButton({
  children,
  name,
  value,
}: {
  children: ReactNode;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" name={name} value={value} disabled={pending}>
      {pending ? "Working…" : children}
    </button>
  );
}
