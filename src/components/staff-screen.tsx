import { PersonCard, PersonEmail } from "@/components/person-card";
import { RosterSection } from "@/components/roster-section";
import { Badge } from "@/components/ui/badge";
import type { StaffGroup } from "@/lib/staff";

// The roster by department: a section per department, then its colleagues as
// cards. A card reads name over email; the department is the heading, so it
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
            <RosterSection key={group.department} count={group.staff.length} heading={group.department}>
              {group.staff.map((entry) => (
                <PersonCard
                  key={entry.staffId}
                  id={`staff-${entry.staffId}`}
                  initials={entry.initials}
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
