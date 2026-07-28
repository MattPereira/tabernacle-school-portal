"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { PersonCard, PersonEmail } from "@/components/person-card";
import { RosterHeading, RosterSection } from "@/components/roster-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentGroup } from "@/lib/students";
import { countStudents, gradeLevelsIn, selectGradeLevel } from "@/lib/students/grades";
import { searchStudents } from "@/lib/students/search";

// The roster by grade level and then by homeroom: the grade level heads the
// section, each of its homerooms heads a run of cards inside it, and a card is
// just the child. Neither the grade level nor the homeroom is repeated on every
// row — that is what the two headings are for. FACTS ids stay hidden.
//
// 536 children is a long scroll, so the page carries two ways of cutting it
// down and one way of staying oriented inside it: a row of grade-level chips
// that narrows to a single grade, a search box that narrows by name, and
// headings that stick to the top of the viewport while their own section is on
// screen. The chips and the search compose — a search runs across the whole
// school, and the chip then says which grade to read the result in.
//
// A client component for one reason: both narrowings work on an already-loaded
// roster, so neither typing nor picking a grade costs a round trip. The
// narrowings themselves are rules, and live in lib/students.
export function StudentsScreen({ groups }: { groups: StudentGroup[] }) {
  const [query, setQuery] = useState("");
  // null is every grade level, and where the page starts: the whole school is
  // still the default answer.
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);

  // Off the whole roster, not the search result, so the chips stay a fixed row
  // to aim at rather than a set of buttons appearing and vanishing as you type.
  const chips = useMemo(() => gradeLevelsIn(groups), [groups]);
  const matching = useMemo(
    () => selectGradeLevel(searchStudents(groups, query), gradeLevel),
    [groups, query, gradeLevel],
  );

  const shown = matching.reduce((count, group) => count + countStudents(group), 0);
  const enrolled = groups.reduce((count, group) => count + countStudents(group), 0);
  const narrowed = Boolean(query.trim()) || gradeLevel !== null;

  return (
    <div>
      <header className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-medium">Students</h1>
          {/* The count is the enrolled total, not what's on screen: a roster
              that quietly renumbers itself as you narrow it answers a different
              question. What the narrowing left is said beside it instead. */}
          <Badge variant="secondary">{enrolled}</Badge>
          {narrowed && <span className="text-sm text-muted-foreground">{shown} shown</span>}

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
        </div>

        {/* One press, one grade — pressing the grade you are already on returns
            you to all of them, so the row never needs a separate way out. The
            chips carry no counts: they are a row of destinations, and the
            heading each one lands on already says how many are there. */}
        <div aria-label="Filter by grade level" className="flex flex-wrap gap-1.5" role="group">
          <Chip label="All" onPress={() => setGradeLevel(null)} pressed={gradeLevel === null} />
          {chips.map((chip) => (
            <Chip
              key={chip}
              label={chip}
              onPress={() => setGradeLevel(gradeLevel === chip ? null : chip)}
              pressed={gradeLevel === chip}
            />
          ))}
        </div>
      </header>

      {enrolled === 0 ? (
        <p className="text-sm text-muted-foreground">No students are enrolled.</p>
      ) : shown === 0 ? (
        <p className="text-sm text-muted-foreground">{nothing(query, gradeLevel)}</p>
      ) : (
        <div className="space-y-8">
          {matching.map((group) => (
            <section key={group.gradeLevel}>
              <RosterHeading count={countStudents(group)} heading={group.gradeLevel} sticky />

              <div className="space-y-4">
                {group.homerooms.map((homeroom) => (
                  <RosterSection
                    key={homeroom.homeroom}
                    count={homeroom.students.length}
                    // FACTS' own homeroom code, alone: it is what the office
                    // types, and what the grade level above it can't say.
                    heading={homeroom.homeroom}
                    level={3}
                    sticky
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
                      >
                        <PersonEmail email={entry.contactEmail} />
                      </PersonCard>
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

// One grade-level chip: the label, and nothing else.
//
// The min-width is what makes "K" and "01" the same size. A floor rather than a
// fixed width, and set just past the widest of the short labels, so the row
// stays as tight as a uniform row can be — and so the one label that isn't
// short ("No grade level") can still take the room it needs instead of being
// squeezed or dragging every other chip out to its own width.
function Chip({
  label,
  onPress,
  pressed,
}: {
  label: string;
  onPress: () => void;
  pressed: boolean;
}) {
  return (
    <Button
      aria-pressed={pressed}
      className="min-w-11"
      onClick={onPress}
      size="sm"
      variant={pressed ? "default" : "outline"}
    >
      {label}
    </Button>
  );
}

// What to say when the narrowing left nothing. It names both constraints when
// both are on, because "no students match" in front of a grade chip the reader
// forgot they pressed is the wrong answer to the question they think they asked.
function nothing(query: string, gradeLevel: string | null) {
  const needle = query.trim();
  if (needle && gradeLevel) return `No students in ${gradeLevel} match “${needle}”.`;
  if (needle) return `No students match “${needle}”.`;

  return `No students in ${gradeLevel}.`;
}

