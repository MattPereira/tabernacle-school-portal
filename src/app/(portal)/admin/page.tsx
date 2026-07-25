import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminForm } from "@/components/admin/admin-form";
import { RoleSelect } from "@/components/admin/role-select";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db/client";
import { listLinks, type LinkListing } from "@/lib/identity";
import {
  flaggedPeople,
  latestSyncRun,
  unlinkedPeople,
  type FlaggedPerson,
  type UnlinkedPerson,
} from "@/lib/sync";

import {
  clearFlags,
  confirmSuggestion,
  createPortalAccount,
  editPortalAccount,
  runSync,
} from "./actions";

// The admin screen. It renders three reads and offers four actions; every one
// of them is a call into lib/ (ADR-0002 §2). Editing happens in place: `?edit=`
// names the one row whose form is open, so the page stays a list.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.state !== "linked" || !viewer.admin) redirect("/");

  const [{ edit }, lastRun, queue, flagged, links] = await Promise.all([
    searchParams,
    latestSyncRun(db),
    unlinkedPeople(db),
    flaggedPeople(db),
    listLinks({ db }),
  ]);

  const editing = Number(edit);

  return (
    <PageShell title="Admin" back={{ href: "/", label: "Back to the portal" }} className="max-w-5xl">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>FACTS sync</CardTitle>
            <CardDescription>
              {lastRun ? (
                <>
                  {lastRun.finishedAt
                    ? `Last run ${formatWhen(lastRun.finishedAt)}`
                    : `Last run started ${formatWhen(lastRun.startedAt)}`}{" "}
                  — <strong className="text-foreground">{lastRun.outcome ?? "no outcome yet"}</strong>.{" "}
                  {lastRun.outcome === "applied" ? (
                    <>
                      {lastRun.peopleCount} people, {lastRun.studentCount} students,{" "}
                      {lastRun.staffCount} staff; {lastRun.flaggedCount} records newly flagged as
                      gone from FACTS, {lastRun.unlinkedCount} awaiting a link.
                    </>
                  ) : lastRun.outcome === "failed" ? (
                    // The mirror is untouched: a failed run rolls back (CONTEXT.md, Sync).
                    <>The mirror was left as it was. {lastRun.detail}</>
                  ) : (
                    // The run row is opened at the *start* (ADR-0003), so a null outcome
                    // means in-flight or crashed and nothing here can tell which. Say
                    // both rather than accuse a sync that's still running of failing.
                    <>
                      It hasn&apos;t recorded an outcome — it is either still running or it was
                      interrupted. Reload in a moment to see which.
                    </>
                  )}
                </>
              ) : (
                "Never run."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminForm action={runSync}>
              <SubmitButton>Sync now</SubmitButton>
            </AdminForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Awaiting a link <Badge variant="secondary">{queue.length}</Badge>
            </CardTitle>
            <CardDescription>
              People FACTS knows about who can&apos;t sign in yet. Sync never links anyone — every
              row here is a deliberate choice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody. Everyone in FACTS has a portal account.
              </p>
            ) : (
              <ul className="space-y-3">
                {queue.map((person) => (
                  <li key={person.personId} className="rounded-lg border p-3">
                    <UnlinkedRow person={person} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            {/* People, where the run banner counts records — one departing student is
                flagged in both mirror_person and mirror_student. Both are true; label
                them so they don't read as a contradiction. */}
            <CardTitle className="flex items-center gap-2">
              Flagged as gone from FACTS <Badge variant="secondary">{flagged.length} people</Badge>
            </CardTitle>
            <CardDescription>
              Sync never deletes — people who leave the FACTS active set are flagged here, not
              revoked (ADR-0001). If a sync obviously misfired, clear its flags in one click; a
              healthy re-sync also clears them (ADR-0003).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {flagged.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody flagged.</p>
            ) : (
              <div className="space-y-3">
                {groupByRun(flagged).map((run) => (
                  <div key={run.runId} className="space-y-3 rounded-lg border p-3">
                    <h3 className="text-sm font-medium">
                      Sync #{run.runId}, {formatWhen(run.flaggedAt)} ({run.people.length})
                    </h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {run.people.map((person) => (
                        <li key={person.personId}>
                          {[person.firstName, person.lastName].filter(Boolean).join(" ") ||
                            "(no name)"}{" "}
                          #{person.personId}
                        </li>
                      ))}
                    </ul>
                    <AdminForm action={clearFlags}>
                      <input type="hidden" name="runId" value={run.runId} />
                      <SubmitButton variant="outline" size="sm">
                        Clear this sync&apos;s flags
                      </SubmitButton>
                    </AdminForm>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Portal accounts <Badge variant="secondary">{links.length}</Badge>
            </CardTitle>
            <CardDescription>
              A row here <em>is</em> the permission to sign in. Removing access is IT&apos;s job —
              suspending the Google account is the kill switch (ADR-0001).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Google account</TableHead>
                  <TableHead>FACTS person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) =>
                  link.id === editing ? (
                    <TableRow key={link.id}>
                      <TableCell colSpan={5}>
                        <EditRow link={link} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.googleEmail}</TableCell>
                      <TableCell>
                        {link.factsPersonId ? (
                          <>
                            {link.factsName ?? (
                              // A link can name a FACTS person the mirror hasn't seen
                              // yet — that's a sync that hasn't run, not a fault, and
                              // the login works either way.
                              <span className="text-muted-foreground">no synced name yet</span>
                            )}{" "}
                            #{link.factsPersonId}
                          </>
                        ) : (
                          // Admin-created only; sync can never mint one.
                          <em className="text-muted-foreground">none</em>
                        )}
                      </TableCell>
                      <TableCell>{link.role}</TableCell>
                      <TableCell>
                        {link.admin ? "yes" : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin?edit=${link.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a portal account</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminForm action={createPortalAccount} className="max-w-sm space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="new-google-email">School Google account</Label>
                <Input
                  id="new-google-email"
                  name="googleEmail"
                  type="email"
                  placeholder="name@tbs.org"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-facts-person-id">FACTS person id</Label>
                <Input id="new-facts-person-id" name="factsPersonId" inputMode="numeric" />
                <p className="text-xs text-muted-foreground">
                  Leave blank for someone FACTS doesn&apos;t track.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-role">Role</Label>
                <RoleSelect id="new-role" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="new-admin" name="admin" />
                <Label htmlFor="new-admin">Can use this admin screen</Label>
              </div>
              <SubmitButton>Create account</SubmitButton>
            </AdminForm>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

// One FACTS person with no portal account. Two ways out: adopt an existing
// account that looks like them, or create one.
function UnlinkedRow({ person }: { person: UnlinkedPerson }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || "(no name)";

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <strong className="font-medium">{name}</strong>{" "}
        <span className="text-muted-foreground">#{person.personId}</span>
      </p>
      {person.suggestions.map((suggestion) => (
        <AdminForm key={suggestion.linkId} action={confirmSuggestion}>
          <input type="hidden" name="id" value={suggestion.linkId} />
          <input type="hidden" name="factsPersonId" value={person.personId} />
          <SubmitButton variant="secondary" size="sm">
            Link {suggestion.googleEmail}
          </SubmitButton>
        </AdminForm>
      ))}
      <AdminForm action={createPortalAccount} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="factsPersonId" value={person.personId} />
        <Input
          name="googleEmail"
          type="email"
          placeholder="name@tbs.org"
          aria-label={`School Google account for ${name}`}
          required
          className="w-56"
        />
        {/* Role is the admin's call, never read off FACTS (ADR-0001). */}
        <SubmitButton name="role" value="student" variant="outline" size="sm">
          Add as student
        </SubmitButton>
        <SubmitButton name="role" value="staff" variant="outline" size="sm">
          Add as staff
        </SubmitButton>
      </AdminForm>
    </div>
  );
}

// Submits every field, so clearing a box really does clear it.
function EditRow({ link }: { link: LinkListing }) {
  return (
    <AdminForm action={editPortalAccount} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={link.id} />
      <strong className="self-center font-medium">{link.googleEmail}</strong>
      <div className="grid w-40 gap-2">
        <Label htmlFor={`edit-facts-${link.id}`}>FACTS person id</Label>
        <Input
          id={`edit-facts-${link.id}`}
          name="factsPersonId"
          inputMode="numeric"
          defaultValue={link.factsPersonId ?? ""}
        />
      </div>
      <div className="grid w-32 gap-2">
        <Label htmlFor={`edit-role-${link.id}`}>Role</Label>
        <RoleSelect id={`edit-role-${link.id}`} defaultValue={link.role} />
      </div>
      <div className="flex h-8 items-center gap-2">
        <Checkbox id={`edit-admin-${link.id}`} name="admin" defaultChecked={link.admin} />
        <Label htmlFor={`edit-admin-${link.id}`}>Admin</Label>
      </div>
      <SubmitButton>Save</SubmitButton>
      <Link href="/admin" className={buttonVariants({ variant: "ghost" })}>
        Cancel
      </Link>
    </AdminForm>
  );
}

// Group the flat flagged list by the run that flagged them, so each misfired
// run gets one heading and one wholesale clear button (ADR-0003). Presentation
// only — the run tag and ordering are lib/sync's answer.
function groupByRun(flagged: FlaggedPerson[]) {
  const runs = new Map<number, { runId: number; flaggedAt: Date; people: FlaggedPerson[] }>();
  for (const person of flagged) {
    const run = runs.get(person.flaggedByRunId);
    if (run) run.people.push(person);
    else runs.set(person.flaggedByRunId, { runId: person.flaggedByRunId, flaggedAt: person.flaggedAt, people: [person] });
  }
  return [...runs.values()];
}

const formatWhen = (at: Date) =>
  at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
