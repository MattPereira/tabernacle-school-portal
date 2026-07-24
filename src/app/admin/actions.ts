"use server";

import { revalidatePath } from "next/cache";

import type { AdminActionState } from "@/components/admin/admin-form";
import { accessOf, requireAdmin } from "@/lib/auth/viewer";
import { db } from "@/lib/db/client";
import { factsClient } from "@/lib/facts/client";
import {
  createLink,
  type LinkFailure,
  type LinkPatch,
  type LinkResult,
  parseFactsPersonId,
  parseRole,
  updateLink,
} from "@/lib/identity";
import { clearRunFlags, sync } from "@/lib/sync";

// Plumbing: these actions marshal a form post into a rule-module call and turn
// its answer into a sentence. Every decision they appear to make was made in
// lib/ (ADR-0002 §2).
//
// The rule modules refuse a non-admin themselves; requireAdmin here stops the
// request before it reaches them and keeps a stray POST out of the logs.
const asAdmin = async () => accessOf(await requireAdmin());

const messages: Record<LinkFailure, string> = {
  forbidden: "You don't have permission to change portal accounts.",
  "not-school-domain": "That isn't a school Google account (@tbs.org).",
  "duplicate-email": "That account already has a portal row — edit it instead.",
  "not-found": "That portal account no longer exists.",
};

const FACTS_ID_ERROR = "The FACTS person id must be a whole number, or blank for none.";

// Every write action ends the same way: a failure becomes its sentence, a
// success revalidates the screen and reports what changed. Only the success
// sentence differs, so that's all each caller supplies.
function settle(result: LinkResult, notice: (email: string) => string): AdminActionState {
  if (!result.ok) return { error: messages[result.reason] };
  revalidatePath("/admin");
  return { notice: notice(result.link.googleEmail) };
}

export async function runSync(_previous: AdminActionState): Promise<AdminActionState> {
  await asAdmin();

  let result;
  try {
    result = await sync({ db, facts: factsClient() });
  } catch (error) {
    // Only a misconfiguration reaches here — sync itself records its own
    // failures and returns them.
    return { error: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/admin");

  if (result.outcome === "failed") return { error: `Sync failed: ${result.detail}` };

  const { people, students, staff, flagged } = result.counts;
  return {
    notice: `Synced ${people} people, ${students} students, ${staff} staff${
      flagged ? `; flagged ${flagged} no longer in FACTS` : ""
    }.`,
  };
}

// One-click undo for a misfired sync (ADR-0003): the run id comes off the
// flagged-people list, lib/sync clears every row that run flagged.
export async function clearFlags(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  await asAdmin();

  const runId = Number(form.get("runId"));
  if (!Number.isInteger(runId)) return { error: "That run is no longer valid — reload the page." };

  await clearRunFlags(db, runId);

  revalidatePath("/admin");
  return { notice: `Cleared the flags from sync #${runId}.` };
}

export async function createPortalAccount(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const actor = await asAdmin();

  const role = parseRole(form.get("role"));
  if (!role) return { error: "Pick a role." };

  const googleEmail = String(form.get("googleEmail") ?? "");
  if (!googleEmail.trim()) return { error: "Enter the school Google account." };

  const factsPersonId = parseFactsPersonId(form.get("factsPersonId"));
  if (!factsPersonId.ok) return { error: FACTS_ID_ERROR };

  const result = await createLink(
    { googleEmail, factsPersonId: factsPersonId.value, role, admin: form.get("admin") === "on" },
    { db, actor },
  );

  return settle(result, (email) => `${email} can now sign in.`);
}

export async function editPortalAccount(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const actor = await asAdmin();

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "That portal account no longer exists." };

  const role = parseRole(form.get("role"));
  if (!role) return { error: "Pick a role." };

  const factsPersonId = parseFactsPersonId(form.get("factsPersonId"));
  if (!factsPersonId.ok) return { error: FACTS_ID_ERROR };

  // The edit form always submits every field, so an unchecked box means false
  // rather than "leave it alone" — which is how admin gets revoked.
  const patch: LinkPatch = { role, admin: form.get("admin") === "on", factsPersonId: factsPersonId.value };

  const result = await updateLink(id, patch, { db, actor });
  return settle(result, (email) => `Saved ${email}.`);
}

// The one-click confirm on the unlinked-people queue (ADR-0001 §6). A
// suggestion is an account that already exists and already has a role — the
// only thing missing is which FACTS person it belongs to, so that is the only
// thing this sets.
export async function confirmSuggestion(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const actor = await asAdmin();

  const id = Number(form.get("id"));
  const factsPersonId = parseFactsPersonId(form.get("factsPersonId"));
  // A suggestion always names a real FACTS person, so a blank or garbage id here
  // means the form is stale, not a deliberate null.
  if (!Number.isInteger(id) || !factsPersonId.ok || factsPersonId.value === null) {
    return { error: "That suggestion is no longer valid — reload the page." };
  }

  const result = await updateLink(id, { factsPersonId: factsPersonId.value }, { db, actor });
  return settle(result, (email) => `Linked ${email}.`);
}
