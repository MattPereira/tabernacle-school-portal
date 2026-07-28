import type { ReactNode } from "react";

import { PersonAvatar } from "@/components/person-avatar";

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
  children,
}: {
  initials: string;
  missingName?: string;
  name: string;
  photoUrl: string | null;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <PersonAvatar initials={initials} photoUrl={photoUrl} />
      <div className="min-w-0">
        <p className={`truncate font-medium ${name ? "" : "text-muted-foreground"}`}>
          {name || missingName}
        </p>
        {children}
      </div>
    </li>
  );
}
