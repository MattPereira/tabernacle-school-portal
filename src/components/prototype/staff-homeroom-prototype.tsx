"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PersonAvatar } from "@/components/person-avatar";
import { PersonEmail } from "@/components/person-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { StaffGroup } from "@/lib/staff";

// PROTOTYPE: Three variants of real Staff homerooms, switchable with ?variant=.
const variants = ["A", "B", "C"] as const;

type Variant = (typeof variants)[number];

export function StaffHomeroomPrototype({ groups }: { groups: StaffGroup[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (variants.includes(searchParams.get("variant") as Variant) ? searchParams.get("variant") : "A") as Variant;

  const select = (variant: Variant) => {
    const params = new URLSearchParams(searchParams);
    params.set("variant", variant);
    router.replace(`?${params}`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement | null)?.isContentEditable) return;
      const index = variants.indexOf(current);
      if (event.key === "ArrowLeft") select(variants[(index + variants.length - 1) % variants.length]);
      if (event.key === "ArrowRight") select(variants[(index + 1) % variants.length]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.department}>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold">{group.department}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...group.staff].sort(byHomeroom).map((entry) => {
                return <VariantCard key={entry.staffId} entry={entry} homeroom={entry.homeroom} variant={current} />;
              })}
            </ul>
          </section>
        ))}
      </div>
      {process.env.NODE_ENV !== "production" && <PrototypeSwitcher current={current} select={select} />}
    </>
  );
}

// PROTOTYPE ONLY: lets the review assess whether homeroom-first scanning is
// preferable to Staff's established surname order. Unassigned staff stay last.
function byHomeroom(a: StaffGroup["staff"][number], b: StaffGroup["staff"][number]) {
  if (!a.homeroom && !b.homeroom) return 0;
  if (!a.homeroom) return 1;
  if (!b.homeroom) return -1;
  return a.homeroom.localeCompare(b.homeroom, undefined, { sensitivity: "base" });
}

function VariantCard({ entry, homeroom, variant }: { entry: StaffGroup["staff"][number]; homeroom: string | null; variant: Variant }) {
  return (
    <li className="relative flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      {variant === "A" && homeroom && <p className="absolute right-4 top-3 max-w-28 truncate text-sm text-muted-foreground">{homeroom}</p>}
      <PersonAvatar initials={entry.initials} photoUrl={entry.photoUrl} />
      <div className={cn("min-w-0", variant === "A" && homeroom && "pr-28")}>
        <p className="truncate font-medium">{entry.name}</p>
        {variant === "B" && homeroom && <Badge variant="outline">{homeroom}</Badge>}
        {variant === "C" && homeroom && <p className="truncate text-sm font-medium">{homeroom}</p>}
        <PersonEmail email={entry.contactEmail} />
      </div>
    </li>
  );
}

function PrototypeSwitcher({ current, select }: { current: Variant; select: (variant: Variant) => void }) {
  const index = variants.indexOf(current);
  const previous = variants[(index + variants.length - 1) % variants.length];
  const next = variants[(index + 1) % variants.length];
  const names = { A: "Quiet line", B: "Badge", C: "Emphasized line" };

  return (
    <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-popover px-3 py-2 shadow-lg">
      <button aria-label="Previous variant" className="text-sm" onClick={() => select(previous)}>←</button>
      <span className="text-sm">{current} — {names[current]}</span>
      <button aria-label="Next variant" className="text-sm" onClick={() => select(next)}>→</button>
    </div>
  );
}
