import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

// What labels a slice of a roster: the label itself and how many are in it.
// `level` is the heading rank, and Students uses both — a grade level is a
// level 2 heading and each of its homerooms a level 3 one under it. It changes
// the weight of the label as well as the tag, because a heading that outranks
// another has to look like it.
export function RosterHeading({
  count,
  heading,
  level = 2,
}: {
  count: number;
  heading: string;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <Heading
      className={
        level === 2
          ? "mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
          : "mb-2 flex items-center gap-2 text-sm font-normal text-muted-foreground"
      }
    >
      {heading}
      <Badge variant="secondary">{count}</Badge>
    </Heading>
  );
}

// One labelled slice of a roster — a department on Staff, a homeroom on
// Students: the heading, and the cards themselves, one column on a phone and up
// to three on a wide screen. A slice whose cards belong under a heading of
// their own instead (a grade level, holding homerooms) composes RosterHeading
// directly rather than coming through here.
export function RosterSection({
  count,
  heading,
  level = 2,
  children,
}: {
  count: number;
  heading: string;
  level?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <section>
      <RosterHeading count={count} heading={heading} level={level} />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}
