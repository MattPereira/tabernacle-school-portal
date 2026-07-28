import { Building2, MapPin } from "lucide-react";

import { PersonAvatar } from "@/components/person-avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { StaffDetail } from "@/lib/staff";

// The Professional staff profile: identity first, then the small number of
// current FACTS facts staff need. Missing facts leave no empty row behind.
export function StaffDetailScreen({ staff }: { staff: StaffDetail }) {
  const hasFacts = staff.department || staff.homerooms.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <PersonAvatar initials={staff.initials} photoUrl={staff.photoUrl} size="large" />
            <div className="min-w-0 space-y-1">
              <h1 className={`text-2xl font-medium ${staff.name ? "" : "text-muted-foreground"}`}>
                {staff.name || "No name in FACTS"}
              </h1>
              {staff.contactEmail && <p className="truncate text-sm text-muted-foreground">{staff.contactEmail}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasFacts && (
        <Card>
          <CardContent>
            <dl className="grid gap-5 md:grid-cols-2">
              {staff.department && <Fact icon={Building2} label="Department">{staff.department}</Fact>}
              {staff.homerooms.length > 0 && (
                <Fact icon={MapPin} label={staff.homerooms.length === 1 ? "Homeroom" : "Homerooms"}>
                  {staff.homerooms.join(", ")}
                </Fact>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof Building2; label: string; children: React.ReactNode }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children}</dd></div></div>;
}
