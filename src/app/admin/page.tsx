import Link from "next/link";

import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { requireAdmin } from "@/lib/auth/viewer";
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
  await requireAdmin();

  const [{ edit }, lastRun, queue, flagged, links] = await Promise.all([
    searchParams,
    latestSyncRun(db),
    unlinkedPeople(db),
    flaggedPeople(db),
    listLinks({ db }),
  ]);

  const editing = Number(edit);

  return (
    <main>
      <h1>Admin</h1>
      <p>
        <Link href="/">← Back to the portal</Link>
      </p>

      <section>
        <h2>FACTS sync</h2>
        {lastRun ? (
          <p>
            {lastRun.finishedAt
              ? `Last run ${formatWhen(lastRun.finishedAt)}`
              : `Last run started ${formatWhen(lastRun.startedAt)}`}{" "}
            — <strong>{lastRun.outcome ?? "did not finish"}</strong>.{" "}
            {lastRun.outcome === "applied" ? (
              <>
                {lastRun.peopleCount} people, {lastRun.studentCount} students, {lastRun.staffCount}{" "}
                staff; {lastRun.flaggedCount} newly flagged as gone from FACTS,{" "}
                {lastRun.unlinkedCount} awaiting a link.
              </>
            ) : lastRun.outcome === "failed" ? (
              // The mirror is untouched: a failed run rolls back (CONTEXT.md, Sync).
              <>The mirror was left as it was. {lastRun.detail}</>
            ) : (
              // No terminal outcome: the run was interrupted mid-flight (ADR-0003).
              <>It started but never recorded an outcome — it was interrupted.</>
            )}
          </p>
        ) : (
          <p>Never run.</p>
        )}
        <AdminForm action={runSync}>
          <SubmitButton>Sync now</SubmitButton>
        </AdminForm>
      </section>

      <section>
        <h2>Awaiting a link ({queue.length})</h2>
        <p>
          People FACTS knows about who can&apos;t sign in yet. Sync never links anyone — every row
          here is a deliberate choice.
        </p>
        {queue.length === 0 ? (
          <p>Nobody. Everyone in FACTS has a portal account.</p>
        ) : (
          <ul>
            {queue.map((person) => (
              <li key={person.personId}>
                <UnlinkedRow person={person} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Flagged as gone from FACTS ({flagged.length})</h2>
        <p>
          Sync never deletes — people who leave the FACTS active set are flagged here, not revoked
          (ADR-0001). If a sync obviously misfired, clear its flags in one click; a healthy re-sync
          also clears them (ADR-0003).
        </p>
        {flagged.length === 0 ? (
          <p>Nobody flagged.</p>
        ) : (
          groupByRun(flagged).map((run) => (
            <div key={run.runId}>
              <h3>
                Sync #{run.runId}, {formatWhen(run.flaggedAt)} ({run.people.length})
              </h3>
              <ul>
                {run.people.map((person) => (
                  <li key={person.personId}>
                    {[person.firstName, person.lastName].filter(Boolean).join(" ") || "(no name)"} #
                    {person.personId}
                  </li>
                ))}
              </ul>
              <AdminForm action={clearFlags}>
                <input type="hidden" name="runId" value={run.runId} />
                <SubmitButton>Clear this sync&apos;s flags</SubmitButton>
              </AdminForm>
            </div>
          ))
        )}
      </section>

      <section>
        <h2>Portal accounts ({links.length})</h2>
        <p>
          A row here <em>is</em> the permission to sign in. Removing access is IT&apos;s job —
          suspending the Google account is the kill switch (ADR-0001).
        </p>
        <table>
          <thead>
            <tr>
              <th>Google account</th>
              <th>FACTS person</th>
              <th>Role</th>
              <th>Admin</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {links.map((link) =>
              link.id === editing ? (
                <tr key={link.id}>
                  <td colSpan={5}>
                    <EditRow link={link} />
                  </td>
                </tr>
              ) : (
                <tr key={link.id}>
                  <td>{link.googleEmail}</td>
                  <td>
                    {link.factsPersonId ? (
                      <>
                        {link.factsName ?? "(not in the mirror)"} #{link.factsPersonId}
                      </>
                    ) : (
                      // Admin-created only; sync can never mint one.
                      <em>none</em>
                    )}
                  </td>
                  <td>{link.role}</td>
                  <td>{link.admin ? "yes" : "—"}</td>
                  <td>
                    <Link href={`/admin?edit=${link.id}`}>Edit</Link>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Add a portal account</h2>
        <AdminForm action={createPortalAccount}>
          <p>
            <label>
              School Google account{" "}
              <input name="googleEmail" type="email" placeholder="name@tbs.org" required />
            </label>
          </p>
          <p>
            <label>
              FACTS person id <input name="factsPersonId" inputMode="numeric" />
            </label>{" "}
            <small>Leave blank for someone FACTS doesn&apos;t track.</small>
          </p>
          <p>
            <label>
              Role <RoleSelect />
            </label>
          </p>
          <p>
            <label>
              <input name="admin" type="checkbox" /> Can use this admin screen
            </label>
          </p>
          <SubmitButton>Create account</SubmitButton>
        </AdminForm>
      </section>
    </main>
  );
}

// One FACTS person with no portal account. Two ways out: adopt an existing
// account that looks like them, or create one.
function UnlinkedRow({ person }: { person: UnlinkedPerson }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || "(no name)";

  return (
    <>
      <strong>{name}</strong> #{person.personId}
      {person.suggestions.map((suggestion) => (
        <AdminForm key={suggestion.linkId} action={confirmSuggestion}>
          <input type="hidden" name="id" value={suggestion.linkId} />
          <input type="hidden" name="factsPersonId" value={person.personId} />
          <SubmitButton>Link {suggestion.googleEmail}</SubmitButton>
        </AdminForm>
      ))}
      <AdminForm action={createPortalAccount}>
        <input type="hidden" name="factsPersonId" value={person.personId} />
        <input name="googleEmail" type="email" placeholder="name@tbs.org" required />
        {/* Role is the admin's call, never read off FACTS (ADR-0001). */}
        <SubmitButton name="role" value="student">
          Add as student
        </SubmitButton>
        <SubmitButton name="role" value="staff">
          Add as staff
        </SubmitButton>
      </AdminForm>
    </>
  );
}

// Submits every field, so clearing a box really does clear it.
function EditRow({ link }: { link: LinkListing }) {
  return (
    <AdminForm action={editPortalAccount}>
      <input type="hidden" name="id" value={link.id} />
      <strong>{link.googleEmail}</strong>{" "}
      <label>
        FACTS person id{" "}
        <input name="factsPersonId" inputMode="numeric" defaultValue={link.factsPersonId ?? ""} />
      </label>{" "}
      <label>
        Role <RoleSelect defaultValue={link.role} />
      </label>{" "}
      <label>
        <input name="admin" type="checkbox" defaultChecked={link.admin} /> Admin
      </label>{" "}
      <SubmitButton>Save</SubmitButton> <Link href="/admin">Cancel</Link>
    </AdminForm>
  );
}

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="role" defaultValue={defaultValue}>
      <option value="student">student</option>
      <option value="staff">staff</option>
    </select>
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
