import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

// What labels a slice of a roster: the label itself and how many are in it.
// `level` is the heading rank, and Students uses both — a grade level is a
// level 2 heading and each of its homerooms a level 3 one under it. It changes
// the weight of the label as well as the tag, because a heading that outranks
// another has to look like it: the grade level reads large over a rule, the
// level under it smaller and plainer. Both stay at full contrast — a homeroom
// is a real division of a grade, not an aside about one.
//
// `sticky` pins the heading to the top of the viewport for as long as its own
// section is on screen — the answer to "which grade am I looking at?" 400 cards
// into a scroll. Both ranks can stick at once: the level 3 offset is the height
// of the level 2 heading, so a homeroom parks directly under its grade level
// rather than on top of it. Opt-in, because a roster short enough to hold in
// one screen gains nothing from it.
export function RosterHeading({
  count,
  heading,
  level = 2,
  sticky = false,
}: {
  count: number;
  heading: string;
  level?: 2 | 3;
  sticky?: boolean;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <Heading
      className={cn(
        level === 2
          ? "mb-3 flex items-center gap-2 border-b pb-2 text-lg font-semibold"
          : "mb-2 flex items-center gap-2 text-sm font-medium",
        // The background is what stops the cards scrolling through the text,
        // and the z-index what keeps the grade level above the homeroom it
        // catches up with.
        sticky && "bg-background",
        sticky && (level === 2 ? "sticky top-0 z-20 pt-2" : "sticky top-11 z-10 py-1"),
      )}
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
  sticky = false,
  children,
}: {
  count: number;
  heading: string;
  level?: 2 | 3;
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <RosterHeading count={count} heading={heading} level={level} sticky={sticky} />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}
