import { StaffAvatar } from "@/components/staff-avatar";
import { Badge } from "@/components/ui/badge";
import type { StaffGroup } from "@/lib/staff";

// The roster by department: a heading per department, then its colleagues as
// cards filling the page width — one column on a phone, up to three on a wide
// screen. A card reads name over email; the department is the heading, so it
// isn't repeated on every row. Names read First Middle Last; FACTS ids stay
// hidden.
export function StaffScreen({ groups }: { groups: StaffGroup[] }) {
  const total = groups.reduce((count, group) => count + group.staff.length, 0);

  return (
    <div>
      <header className="mb-6 flex items-center gap-2">
        <h1 className="text-2xl font-medium">Staff</h1>
        <Badge variant="secondary">{total}</Badge>
      </header>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No staff are available.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.department}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {group.department}
                <Badge variant="secondary">{group.staff.length}</Badge>
              </h2>

              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.staff.map((entry) => (
                  <li
                    key={entry.staffId}
                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                  >
                    <StaffAvatar initials={entry.initials} photoUrl={entry.photoUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{entry.name}</p>
                      {entry.contactEmail && (
                        <a
                          className="block truncate text-sm text-muted-foreground hover:text-foreground hover:underline"
                          href={`mailto:${encodeURI(entry.contactEmail)}`}
                          title={entry.contactEmail}
                        >
                          {entry.contactEmail}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
