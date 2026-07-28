"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { PersonCard } from "@/components/person-card";
import { RosterHeading, RosterSection } from "@/components/roster-section";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { HomeroomGroup, StudentGroup } from "@/lib/students";
import { searchStudents } from "@/lib/students/search";

// The roster by grade level and then by homeroom: the grade level heads the
// section, each of its homerooms heads a run of cards inside it, and a card is
// just the child. Neither the grade level nor the homeroom is repeated on every
// row — that is what the two headings are for. FACTS ids stay hidden.
//
// A client component for one reason: the search box narrows an already-loaded
// roster, so typing costs no round trip. The narrowing itself is a rule, and
// lives in lib/students/search.
export function StudentsScreen({ groups }: { groups: StudentGroup[] }) {
  const [query, setQuery] = useState("");
  const matching = useMemo(() => searchStudents(groups, query), [groups, query]);
  const shown = matching.reduce((count, group) => count + size(group), 0);
  const enrolled = groups.reduce((count, group) => count + size(group), 0);

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
            <section key={group.gradeLevel}>
              <RosterHeading count={size(group)} heading={group.gradeLevel} />

              <div className="space-y-4">
                {group.homerooms.map((homeroom) => (
                  <RosterSection
                    key={homeroom.homeroom}
                    count={homeroom.students.length}
                    heading={heading(homeroom)}
                    level={3}
                  >
                    {homeroom.students.map((entry) => (
                      <PersonCard
                        key={entry.studentId}
                        initials={entry.initials}
                        // A child FACTS holds no person row for still belongs on
                        // the roster; the gap is theirs to see, not ours to hide.
                        missingName="No name in FACTS"
                        name={entry.name}
                        photoUrl={entry.photoUrl}
                      />
                    ))}
                  </RosterSection>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// What a homeroom heading reads: FACTS' own code first, because that is what
// the office types and what the grade level alone can't say, then the teacher,
// because that is who everyone else knows the class by. A homeroom FACTS gave
// no teacher — and the run of students it assigned no homeroom at all — is just
// the code.
const heading = (homeroom: HomeroomGroup) =>
  homeroom.teacher ? `${homeroom.homeroom} · ${homeroom.teacher}` : homeroom.homeroom;

// How many students a grade level holds, across its homerooms.
const size = (group: StudentGroup) =>
  group.homerooms.reduce((count, homeroom) => count + homeroom.students.length, 0);
