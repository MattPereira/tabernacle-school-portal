import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

// One labelled slice of a roster — a department on Staff, a grade level on
// Students: the heading, how many are in it, and the cards themselves, one
// column on a phone and up to three on a wide screen.
export function RosterSection({
  count,
  heading,
  children,
}: {
  count: number;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
        <Badge variant="secondary">{count}</Badge>
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}
