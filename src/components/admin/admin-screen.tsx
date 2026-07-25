import Link from "next/link";
import {
  CheckCircle2Icon,
  Clock3Icon,
  DatabaseIcon,
  PlusIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { AdminForm } from "@/components/admin/admin-form";
import { AccountSearch } from "@/components/admin/account-search";
import { RoleSelect } from "@/components/admin/role-select";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { SyncRun } from "@/lib/db/schema";
import type { LinkListing } from "@/lib/identity";
import type { FlaggedPerson, UnlinkedPerson } from "@/lib/sync";

import {
  clearFlags,
  confirmSuggestion,
  createPortalAccount,
  editPortalAccount,
  runSync,
} from "@/app/(portal)/admin/actions";

export function AdminScreen({
  editing,
  adding,
  showAll,
  query,
  lastRun,
  queue,
  flagged,
  links,
}: {
  editing: number;
  adding: boolean;
  showAll: boolean;
  query: string;
  lastRun: SyncRun | null;
  queue: UnlinkedPerson[];
  flagged: FlaggedPerson[];
  links: LinkListing[];
}) {
  const workCount = queue.length + flagged.length;
  const normalizedQuery = query.trim().toLowerCase();
  const matchingLinks = normalizedQuery
    ? links.filter((link) =>
        [link.googleEmail, link.factsName, link.factsPersonId?.toString(), link.role]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery)),
      )
    : links;
  const visibleLinks = showAll ? matchingLinks : matchingLinks.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Sync health, admin work, and the portal allowlist.</p>
        </div>
        <AdminForm action={runSync}><SubmitButton>Sync FACTS</SubmitButton></AdminForm>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={DatabaseIcon} label="FACTS sync" value={syncStatus(lastRun)} />
        <Metric icon={Clock3Icon} label="Last run" value={lastRun?.finishedAt ? formatWhen(lastRun.finishedAt) : "Never"} />
        <Metric icon={TriangleAlertIcon} label="Needs attention" value={String(workCount)} />
        <Metric icon={ShieldCheckIcon} label="Portal accounts" value={String(links.length)} />
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Admin work <Badge variant="secondary">{workCount}</Badge></CardTitle>
          <CardDescription>
            Awaiting links and inactive FACTS records, together. Inactive records are review-only; portal access remains unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Meaning</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((person) => <UnlinkedWorkRow key={person.personId} person={person} />)}
              {groupByRun(flagged).map((run) => <FlaggedWorkRow key={run.runId} run={run} />)}
              {workCount === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground"><CheckCircle2Icon className="mr-2 inline" />Nothing needs attention.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {adding && <Card id="add-account">
        <CardHeader><CardTitle>Add a portal account</CardTitle><CardDescription>Create a portal-owned login identity, optionally linked to FACTS.</CardDescription></CardHeader>
        <CardContent>
          <AdminForm action={createPortalAccount} className="flex max-w-sm flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-google-email">School Google account</Label>
              <Input id="new-google-email" name="googleEmail" type="email" placeholder="name@tbs.org" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-facts-person-id">FACTS person id</Label>
              <Input id="new-facts-person-id" name="factsPersonId" inputMode="numeric" />
              <p className="text-xs text-muted-foreground">Leave blank for someone FACTS doesn&apos;t track.</p>
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
            <Link href="/admin" className={buttonVariants({ variant: "ghost" })}>Cancel</Link>
          </AdminForm>
        </CardContent>
      </Card>}

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Portal accounts <Badge variant="secondary">{links.length}</Badge></CardTitle>
          <CardDescription>A row is permission to sign in. Search the allowlist; Workspace suspension remains the kill switch.</CardDescription>
          <CardAction>
            <Link href="/admin?add=1#add-account" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <PlusIcon data-icon="inline-start" /> Add portal account
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AccountSearch key={query} query={query} />
          <Table>
            <TableHeader><TableRow><TableHead>Google account</TableHead><TableHead>FACTS person</TableHead><TableHead>Role</TableHead><TableHead>Admin</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {visibleLinks.map((link) => link.id === editing ? (
                <TableRow key={link.id}><TableCell colSpan={5}><EditRow link={link} /></TableCell></TableRow>
              ) : (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.googleEmail}</TableCell>
                  <TableCell>{link.factsPersonId ? <>{link.factsName ?? <span className="text-muted-foreground">no synced name yet</span>} #{link.factsPersonId}</> : <em className="text-muted-foreground">none</em>}</TableCell>
                  <TableCell>{link.role}</TableCell>
                  <TableCell>{link.admin ? "yes" : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin?edit=${link.id}${showAll ? "&all=1" : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {visibleLinks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No portal accounts match.</TableCell></TableRow>}
            </TableBody>
          </Table>
          {!showAll && matchingLinks.length > visibleLinks.length && (
            <Link href={`/admin?all=1${query ? `&q=${encodeURIComponent(query)}` : ""}`} className={buttonVariants({ variant: "ghost" })}>View all {matchingLinks.length} matching accounts</Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UnlinkedWorkRow({ person }: { person: UnlinkedPerson }) {
  return (
    <TableRow>
      <TableCell><Badge>Awaiting link</Badge></TableCell>
      <TableCell className="font-medium">{personName(person)} <span className="text-muted-foreground">#{person.personId}</span></TableCell>
      <TableCell className="text-muted-foreground">Cannot sign in yet</TableCell>
      <TableCell><UnlinkedRow person={person} compact /></TableCell>
    </TableRow>
  );
}

function FlaggedWorkRow({ run }: { run: ReturnType<typeof groupByRun>[number] }) {
  return (
    <TableRow>
      <TableCell><Badge variant="outline">Inactive</Badge></TableCell>
      <TableCell className="font-medium">{run.people.map(personName).join(", ")}</TableCell>
      <TableCell className="text-muted-foreground">Sync #{run.runId}; access unchanged</TableCell>
      <TableCell className="text-right">
        <AdminForm action={clearFlags}>
          <input type="hidden" name="runId" value={run.runId} />
          <SubmitButton variant="ghost" size="sm">Clear sync flags</SubmitButton>
        </AdminForm>
      </TableCell>
    </TableRow>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof DatabaseIcon; label: string; value: string }) {
  return <Card size="sm"><CardHeader><CardDescription className="flex items-center gap-2"><Icon /> {label}</CardDescription><CardTitle>{value}</CardTitle></CardHeader></Card>;
}

function UnlinkedRow({ person, compact = false }: { person: UnlinkedPerson; compact?: boolean }) {
  const name = personName(person);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!compact && <p className="text-sm"><strong className="font-medium">{name}</strong> <span className="text-muted-foreground">#{person.personId}</span></p>}
      {person.suggestions.map((suggestion) => (
        <AdminForm key={suggestion.linkId} action={confirmSuggestion}>
          <input type="hidden" name="id" value={suggestion.linkId} />
          <input type="hidden" name="factsPersonId" value={person.personId} />
          <SubmitButton variant="secondary" size="sm">Link {suggestion.googleEmail}</SubmitButton>
        </AdminForm>
      ))}
      <AdminForm action={createPortalAccount} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="factsPersonId" value={person.personId} />
        <Input name="googleEmail" type="email" placeholder="name@tbs.org" aria-label={`School Google account for ${name}`} required className="w-56" />
        <SubmitButton name="role" value="student" variant="outline" size="sm">Add as student</SubmitButton>
        <SubmitButton name="role" value="staff" variant="outline" size="sm">Add as staff</SubmitButton>
      </AdminForm>
    </div>
  );
}

function EditRow({ link }: { link: LinkListing }) {
  return (
    <AdminForm action={editPortalAccount} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={link.id} />
      <strong className="self-center font-medium">{link.googleEmail}</strong>
      <div className="grid w-40 gap-2">
        <Label htmlFor={`edit-facts-${link.id}`}>FACTS person id</Label>
        <Input id={`edit-facts-${link.id}`} name="factsPersonId" inputMode="numeric" defaultValue={link.factsPersonId ?? ""} />
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
      <Link href="/admin" className={buttonVariants({ variant: "ghost" })}>Cancel</Link>
    </AdminForm>
  );
}

function groupByRun(flagged: FlaggedPerson[]) {
  const runs = new Map<number, { runId: number; flaggedAt: Date; people: FlaggedPerson[] }>();
  for (const person of flagged) {
    const run = runs.get(person.flaggedByRunId);
    if (run) run.people.push(person);
    else runs.set(person.flaggedByRunId, { runId: person.flaggedByRunId, flaggedAt: person.flaggedAt, people: [person] });
  }
  return [...runs.values()];
}

const formatWhen = (at: Date) => at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const personName = (person: { firstName: string | null; lastName: string | null }) =>
  [person.firstName, person.lastName].filter(Boolean).join(" ") || "(no name)";
const syncStatus = (lastRun: SyncRun | null) =>
  !lastRun ? "Never synced" : lastRun.outcome === "applied" ? "Ready" : lastRun.outcome === "failed" ? "Failed" : "Unfinished";
