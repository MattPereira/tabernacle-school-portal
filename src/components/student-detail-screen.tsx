import Link from "next/link";
import { CalendarDays, GraduationCap, MapPin, UserRound } from "lucide-react";

import { PersonAvatar } from "@/components/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentDetail } from "@/lib/students";

// Production form of prototype A (#56): identity leads; enrolment facts are
// primary; a homeroom is a secondary companion and disappears as a whole when
// FACTS assigns none.
export function StudentDetailScreen({ student }: { student: StudentDetail }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardContent>
          <div className="relative flex items-center gap-4">
            <PersonAvatar initials={student.initials} photoUrl={student.photoUrl} size="large" />
            <div className={`min-w-0 space-y-1 ${student.status ? "pr-24" : ""}`}>
              <h1 className={`text-3xl font-medium ${student.name ? "" : "text-muted-foreground"}`}>
                {student.name || "No name in FACTS"}
              </h1>
              {student.gradeLevel && <p className="text-sm text-muted-foreground">{student.gradeLevel}</p>}
              {student.contactEmail && <p className="truncate text-sm text-muted-foreground">{student.contactEmail}</p>}
            </div>
            {student.status && <Badge className="absolute right-0 top-0" variant="secondary">{student.status}</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-6 ${student.homeroom ? "md:grid-cols-[1fr_0.8fr]" : ""}`}>
        <Section title="Enrolment">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Fact icon={GraduationCap} label="Enrolled since">{student.enrolledSince && date(student.enrolledSince)}</Fact>
            <Fact icon={CalendarDays} label="Birthdate">{student.birthdate && date(student.birthdate)}</Fact>
            <Fact icon={UserRound} label="Age">{student.age === null ? null : `${student.age} years old`}</Fact>
          </dl>
        </Section>

        {student.homeroom && (
          <Section title="Homeroom">
            <div className="flex gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                {(student.homeroom.label || student.homeroom.room) && (
                  <p className="font-medium">
                    {student.homeroom.label}
                    {student.homeroom.label && student.homeroom.room && <span className="font-normal text-muted-foreground"> · </span>}
                    {student.homeroom.room && <span className="font-normal text-muted-foreground">{student.homeroom.room}</span>}
                  </p>
                )}
                {student.homeroom.teacherName && (
                  <Link className="text-sm underline underline-offset-4" href={`/staff#staff-${student.homeroom.teacherId}`}>
                    {student.homeroom.teacherName}
                  </Link>
                )}
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

function Fact({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children ?? "—"}</dd></div></div>;
}

// A FACTS date is a calendar day. Pin the formatting instant to UTC so a
// server/user timezone cannot print the previous day.
function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
