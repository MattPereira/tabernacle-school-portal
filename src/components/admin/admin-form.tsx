"use client";

import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";

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
// `className` replaces the default rather than merging with it: several of these
// forms lay their fields out in a row, and `space-y-*` on a flex container puts
// margins where the gap already is.
export function AdminForm({
  action,
  className = "space-y-3",
  children,
}: {
  action: AdminAction;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      {/* The roles stay as they were. Alert hardcodes role="alert", so the
          notice is the one that has to say otherwise. */}
      {state && "error" in state && (
        <Alert variant="destructive" className="bg-destructive/10">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state && "notice" in state && (
        <Alert role="status" className="bg-muted/50">
          <CircleCheckIcon />
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
