"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { PersonCard } from "@/components/person-card";
import { RosterSection } from "@/components/roster-section";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { StudentGroup } from "@/lib/students";
import { searchStudents } from "@/lib/students/search";

// The roster by grade level: a section per grade level in the school's own
// order, then its students as cards. A card reads name over homeroom; the grade
// level is the heading, so it isn't repeated on every row. FACTS ids stay
// hidden.
//
// A client component for one reason: the search box narrows an already-loaded
// roster, so typing costs no round trip. The narrowing itself is a rule, and
// lives in lib/students/search.
export function StudentsScreen({ groups }: { groups: StudentGroup[] }) {
  const [query, setQuery] = useState("");
  const matching = useMemo(() => searchStudents(groups, query), [groups, query]);
  const shown = matching.reduce((count, group) => count + group.students.length, 0);
  const enrolled = groups.reduce((count, group) => count + group.students.length, 0);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-medium">Students</h1>
        {/* The count is the enrolled total, not the search result: a roster
            that quietly renumbers itself as you type answers a different
            question. What a search matched is said beside it instead. */}
        <Badge variant="secondary">{enrolled}</Badge>
        {query.trim() && (
          <span className="text-sm text-muted-foreground">{shown} matching</span>
        )}

        <div className="relative ms-auto w-full sm:w-64">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search students by name"
            className="ps-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
            type="search"
            value={query}
          />
        </div>
      </header>

      {enrolled === 0 ? (
        <p className="text-sm text-muted-foreground">No students are enrolled.</p>
      ) : shown === 0 ? (
        <p className="text-sm text-muted-foreground">No students match “{query.trim()}”.</p>
      ) : (
        <div className="space-y-8">
          {matching.map((group) => (
            <RosterSection
              key={group.gradeLevel}
              count={group.students.length}
              heading={group.gradeLevel}
            >
              {group.students.map((entry) => (
                <PersonCard
                  key={entry.studentId}
                  initials={entry.initials}
                  // A child FACTS holds no person row for still belongs on the
                  // roster; the gap is theirs to see, not ours to hide.
                  missingName="No name in FACTS"
                  name={entry.name}
                  photoUrl={entry.photoUrl}
                >
                  {/* Same again for the ~62 students FACTS assigns no
                      homeroom: named, not left blank. */}
                  <p
                    className="truncate text-sm text-muted-foreground"
                    title={entry.homeroom ?? undefined}
                  >
                    {entry.homeroom ?? "No homeroom"}
                  </p>
                </PersonCard>
              ))}
            </RosterSection>
          ))}
        </div>
      )}
    </div>
  );
}
