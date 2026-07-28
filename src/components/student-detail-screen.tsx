import { CalendarDays, GraduationCap, MapPin, UserRound } from "lucide-react";

import { PersonAvatar } from "@/components/person-avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { StudentDetail } from "@/lib/students";

// Production form of prototype A (#56): identity leads, followed by the few
// facts staff need to scan. An unassigned homeroom leaves no empty fact behind.
export function StudentDetailScreen({ student }: { student: StudentDetail }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <PersonAvatar initials={student.initials} photoUrl={student.photoUrl} size="large" />
            <div className="min-w-0 space-y-1">
              <h1 className={`text-2xl font-medium ${student.name ? "" : "text-muted-foreground"}`}>
                {student.name || "No name in FACTS"}
              </h1>
              {student.contactEmail && <p className="truncate text-sm text-muted-foreground">{student.contactEmail}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <dl className="grid gap-5 md:grid-cols-2">
            <Fact icon={CalendarDays} label="Birthdate">{student.birthdate && date(student.birthdate)}</Fact>
            <Fact icon={UserRound} label="Age">{student.age === null ? null : `${student.age} years old`}</Fact>
            <Fact icon={GraduationCap} label="Enrolled since">{student.enrolledSince && date(student.enrolledSince)}</Fact>
            {student.homeroom && (
              <Fact icon={MapPin} label="Homeroom">
                <span>
                  {student.homeroom.label}
                  {student.homeroom.label && student.homeroom.room && <span className="text-muted-foreground"> · </span>}
                  {student.homeroom.room && <span className="text-muted-foreground">{student.homeroom.room}</span>}
                </span>
              </Fact>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children ?? "—"}</dd></div></div>;
}

// A FACTS date is a calendar day. Pin the formatting instant to UTC so a
// server/user timezone cannot print the previous day.
function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
