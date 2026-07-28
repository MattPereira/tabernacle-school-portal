import type { ReactNode } from "react";

import { PersonAvatar } from "@/components/person-avatar";
import { cn } from "@/components/ui/utils";

// One person in a roster: face or initials, their name, and optionally one line
// under it — a contact email on Staff. The line itself is the caller's, because
// only the caller knows whether it links anywhere; Students passes none, having
// put the homeroom in the heading over the card instead.
//
// `missingName` is what to say when FACTS has no name to show. Passing it opts
// into a visible gap instead of a blank space; leaving it out renders nothing,
// which is what a surface that would rather stay quiet gets.
export function PersonCard({
  initials,
  missingName,
  name,
  photoUrl,
  topRight,
  children,
}: {
  initials: string;
  missingName?: string;
  name: string;
  photoUrl: string | null;
  topRight?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      {topRight && <div className="absolute right-4 top-3 max-w-28 truncate text-sm text-muted-foreground">{topRight}</div>}
      <PersonAvatar initials={initials} photoUrl={photoUrl} />
      <div className={cn("min-w-0", topRight && "pr-28")}>
        <p className={`truncate font-medium ${name ? "" : "text-muted-foreground"}`}>
          {name || missingName}
        </p>
        {children}
      </div>
    </li>
  );
}

// The line under a name on both rosters: a mailto to the address FACTS holds,
// truncated to the card and carrying the whole thing in its title. Shared so
// that a colleague's contact line and a student's stay the same line — they are
// the same thing, and only the person differs. A card whose person has no
// address renders it not at all rather than leaving a blank row.
export function PersonEmail({ email }: { email: string | null }) {
  if (!email) return null;

  return (
    <a
      className="block truncate text-sm text-muted-foreground hover:text-foreground hover:underline"
      href={`mailto:${encodeURI(email)}`}
      title={email}
    >
      {email}
    </a>
  );
}
