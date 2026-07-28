import { StaffAvatar } from "@/components/staff-avatar";
import type { StaffEntry } from "@/lib/staff";

// A compact row per colleague — the whole active population on one page, and
// scannable on a phone. Names read First Middle Last; FACTS ids stay hidden.
export function StaffScreen({ staff }: { staff: StaffEntry[] }) {
  return (
    <div className="max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl font-medium">Staff</h1>
        <p className="text-sm text-muted-foreground">{staff.length} staff</p>
      </header>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff are available.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {staff.map((entry) => (
            <li
              key={entry.staffId}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <StaffAvatar initials={entry.initials} photoUrl={entry.photoUrl} />
                <div className="min-w-0">
                  <p className="font-medium">{entry.name}</p>
                  {entry.department && (
                    <p className="text-sm text-muted-foreground">{entry.department}</p>
                  )}
                </div>
              </div>
              {entry.contactEmail && (
                <a
                  className="text-sm break-all text-muted-foreground hover:text-foreground hover:underline"
                  href={`mailto:${encodeURI(entry.contactEmail)}`}
                >
                  {entry.contactEmail}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
