"use client";

import { ArrowLeft, ArrowRight, CalendarDays, GraduationCap, MapPin, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { PersonAvatar } from "@/components/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentDetail } from "@/lib/students";

// PROTOTYPE — three student-detail fact hierarchies, switchable at
// /students/[studentId]?variant=A|B|C. The question: which relationships make
// personal facts, enrolment, and homeroom easiest to scan?
const variants = [
  ["A", "Three domains", VariantA],
  ["B", "Student profile", VariantB],
  ["C", "Fact rows", VariantC],
] as const;

export function StudentDetailDataPrototype({ student }: { student: StudentDetail }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const index = Math.max(0, variants.findIndex(([key]) => key === params.get("variant")));
  const [key, label, Variant] = variants[index];

  function cycle(direction: -1 | 1) {
    const next = new URLSearchParams(params.toString());
    next.set("variant", variants[(index + direction + variants.length) % variants.length][0]);
    router.replace(`${pathname}?${next}`);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches("input, textarea, [contenteditable]")) {
        if (event.key === "ArrowLeft") cycle(-1);
        if (event.key === "ArrowRight") cycle(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return <>
    <p className="mb-4 text-sm text-muted-foreground">PROTOTYPE · facts shown: personal, enrolment, homeroom.</p>
    <Variant student={student} />
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-lg">
        <Button aria-label="Previous variant" onClick={() => cycle(-1)} size="icon" variant="ghost"><ArrowLeft /></Button>
        <span className="min-w-40 text-center text-sm font-medium">{key} — {label}</span>
        <Button aria-label="Next variant" onClick={() => cycle(1)} size="icon" variant="ghost"><ArrowRight /></Button>
      </div>
    </div>
  </>;
}

function Header({ student }: { student: StudentDetail }) {
  return <Card><CardContent className="relative flex items-center gap-4"><PersonAvatar initials={student.initials} photoUrl={student.photoUrl} size="large" /><div className={`min-w-0 space-y-1 ${student.status ? "pr-24" : ""}`}><h1 className="text-3xl font-medium">{student.name || "No name in FACTS"}</h1>{student.contactEmail && <p className="truncate text-sm text-muted-foreground">{student.contactEmail}</p>}</div>{student.status && <Badge className="absolute right-4 top-4" variant="secondary">{student.status}</Badge>}</CardContent></Card>;
}

function VariantA({ student }: { student: StudentDetail }) {
  return <div className="mx-auto max-w-4xl space-y-6"><Header student={student} /><div className="grid gap-6 md:grid-cols-2"><Section title="Student"><Facts student={student} fields={["birthdate", "age"]} /></Section><Section title="Enrolment"><Facts student={student} fields={["enrolledSince"]} /></Section></div>{student.homeroom && <Section title="Homeroom"><Homeroom student={student} /></Section>}</div>;
}

function VariantB({ student }: { student: StudentDetail }) {
  return <div className="mx-auto max-w-3xl space-y-6"><Header student={student} /><Section title="Student profile"><div className="divide-y"><Row label="Born" value={student.birthdate && date(student.birthdate)} /><Row label="Age" value={student.age === null ? null : `${student.age} years old`} /><Row label="Enrolled" value={student.enrolledSince && date(student.enrolledSince)} /></div></Section>{student.homeroom && <Section title="Class"><Homeroom student={student} /></Section>}</div>;
}

function VariantC({ student }: { student: StudentDetail }) {
  return <div className="mx-auto max-w-5xl space-y-6"><Header student={student} /><Card><CardContent><dl className="grid gap-8 md:grid-cols-3"><div><h2 className="mb-3 text-sm font-medium text-muted-foreground">Personal</h2><Facts student={student} fields={["birthdate", "age"]} /></div><div><h2 className="mb-3 text-sm font-medium text-muted-foreground">Enrolment</h2><Facts student={student} fields={["enrolledSince"]} /></div>{student.homeroom && <div><h2 className="mb-3 text-sm font-medium text-muted-foreground">Homeroom</h2><Homeroom student={student} /></div>}</dl></CardContent></Card></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }
function Row({ label, value }: { label: string; value: string | null }) { return <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value ?? "—"}</dd></div>; }
function Facts({ student, fields }: { student: StudentDetail; fields: ("birthdate" | "age" | "enrolledSince")[] }) { return <dl className="space-y-4">{fields.map((field) => <div className="flex gap-3" key={field}>{field === "birthdate" ? <CalendarDays className="mt-0.5 size-4 text-muted-foreground" /> : field === "age" ? <UserRound className="mt-0.5 size-4 text-muted-foreground" /> : <GraduationCap className="mt-0.5 size-4 text-muted-foreground" />}<div><dt className="text-sm text-muted-foreground">{field === "birthdate" ? "Birthdate" : field === "age" ? "Age" : "Enrolled since"}</dt><dd className="text-sm font-medium">{field === "birthdate" ? student.birthdate ? date(student.birthdate) : "—" : field === "age" ? student.age === null ? "—" : `${student.age} years old` : student.enrolledSince ? date(student.enrolledSince) : "—"}</dd></div></div>)}</dl>; }
function Homeroom({ student }: { student: StudentDetail }) { const room = student.homeroom!; return <div className="flex gap-3"><MapPin className="mt-0.5 size-4 text-muted-foreground" /><div className="text-sm"><p className="font-medium">{room.label}{room.label && room.room && <span className="font-normal text-muted-foreground"> · </span>}{room.room && <span className="font-normal text-muted-foreground">{room.room}</span>}</p><p className="text-muted-foreground">{room.teacherName}</p></div></div>; }
function date(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
