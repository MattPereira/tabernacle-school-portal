"use client";

import { useMemo, useState } from "react";

import { PersonCard, PersonEmail } from "@/components/person-card";
import { RosterFilterBar } from "@/components/roster-filter-bar";
import { RosterSection } from "@/components/roster-section";
import { Badge } from "@/components/ui/badge";
import type { StaffGroup } from "@/lib/staff";
import { searchStaff } from "@/lib/staff/search";

// The roster by department: a section per department, then its colleagues as
// cards. A card reads name over email; the department is the heading, so it
// isn't repeated on every row. Names read First Middle Last; FACTS ids stay
// hidden.
export function StaffScreen({ groups }: { groups: StaffGroup[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const total = groups.reduce((count, group) => count + group.staff.length, 0);
  const departments = useMemo(() => groups.map((group) => group.department), [groups]);
  const matching = useMemo(
    () => searchStaff(groups, query).filter((group) => department === null || group.department === department),
    [department, groups, query],
  );
  const shown = matching.reduce((count, group) => count + group.staff.length, 0);
  const narrowed = Boolean(query.trim()) || department !== null;

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-medium">Staff</h1>
          <Badge variant="secondary">{total}</Badge>
          {narrowed && <span className="text-sm text-muted-foreground">{shown} shown</span>}
        </div>

        <RosterFilterBar
          filterLabel="Filter by department"
          onQueryChange={setQuery}
          onSelectedChange={setDepartment}
          options={departments}
          query={query}
          searchLabel="staff"
          selected={department}
        />
      </header>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No staff are available.</p>
      ) : shown === 0 ? (
        <p className="text-sm text-muted-foreground">{nothing(query, department)}</p>
      ) : (
        <div className="space-y-8">
          {matching.map((group) => (
            <RosterSection key={group.department} count={group.staff.length} heading={group.department}>
              {group.staff.map((entry) => (
                <PersonCard
                  key={entry.staffId}
                  href={`/staff/${entry.staffId}`}
                  id={`staff-${entry.staffId}`}
                  initials={entry.initials}
                  linkLabel={`View ${entry.name || "staff member with no name in FACTS"}`}
                  name={entry.name}
                  photoUrl={entry.photoUrl}
                  topRight={entry.homeroom}
                >
                  <PersonEmail email={entry.contactEmail} />
                </PersonCard>
              ))}
            </RosterSection>
          ))}
        </div>
      )}
    </div>
  );
}

function nothing(query: string, department: string | null) {
  const needle = query.trim();
  if (needle && department) return `No staff in ${department} match “${needle}”.`;
  if (needle) return `No staff match “${needle}”.`;

  return `No staff in ${department}.`;
}
