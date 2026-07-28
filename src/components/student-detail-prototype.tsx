"use client";

import { CalendarDays, GraduationCap, Mail, MapPin, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useEffect } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrototypeVariantSwitcher } from "@/components/prototype-variant-switcher";

// PROTOTYPE — #56: three variants of a student detail page, switchable via
// ?variant=, on /prototype/student-detail. It asks how identity, enrolment,
// and homeroom should relate when any of those pieces may be absent.
type Sample = {
  key: string;
  name: string | null;
  initials: string;
  grade: string;
  status: string;
  email: string | null;
  enrolledSince: string | null;
  birthdate: string | null;
  age: string | null;
  photo: boolean;
  homeroom: { label: string; room: string; teacher: string } | null;
};

const samples: Sample[] = [
  {
    key: "complete",
    name: "Amelia Torres",
    initials: "AT",
    grade: "Grade 04",
    status: "Enrolled",
    email: "amelia.torres@example.com",
    enrolledSince: "Aug 2023",
    birthdate: "May 14, 2015",
    age: "11 years old",
    photo: true,
    homeroom: { label: "4A", room: "Room 12", teacher: "Jordan Lee" },
  },
  {
    key: "no-homeroom-photo",
    name: "Micah Brooks",
    initials: "MB",
    grade: "Kindergarten",
    status: "Enrolled",
    email: "micah.brooks@example.com",
    enrolledSince: null,
    birthdate: "Jan 8, 2021",
    age: "5 years old",
    photo: false,
    homeroom: null,
  },
  {
    key: "no-person",
    name: null,
    initials: "?",
    grade: "Grade 07",
    status: "Enrolled",
    email: null,
    enrolledSince: "Aug 2021",
    birthdate: null,
    age: null,
    photo: false,
    homeroom: { label: "7B", room: "Room 24", teacher: "Casey Morgan" },
  },
];

const variants = [
  ["A", "Profile lead", VariantA],
  ["B", "Facts first", VariantB],
  ["C", "Homeroom anchor", VariantC],
] as const;

export function StudentDetailPrototype() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const variantKey = params.get("variant");
  const sampleKey = params.get("sample");
  const variantIndex = Math.max(0, variants.findIndex(([key]) => key === variantKey));
  const [variant, label, Variant] = variants[variantIndex];
  const sample = samples.find(({ key }) => key === sampleKey) ?? samples[0];

  function setParam(key: "variant" | "sample", value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function cycle(direction: -1 | 1) {
    setParam("variant", variants[(variantIndex + direction + variants.length) % variants.length][0]);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="pb-20">
      <div className="mb-6 space-y-2">
        <Badge variant="outline">PROTOTYPE · Issue #56</Badge>
        <h1 className="text-2xl font-medium">Student detail layout</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Compare identity, enrolment facts, and homeroom placement. Change sample to expose the absent states.
        </p>
        <div aria-label="Prototype sample" className="flex flex-wrap gap-2" role="group">
          {samples.map((item) => (
            <Button key={item.key} onClick={() => setParam("sample", item.key)} size="sm" variant={sample.key === item.key ? "default" : "outline"}>
              {item.key === "complete" ? "Complete" : item.key === "no-homeroom-photo" ? "No homeroom / photo" : "No person row"}
            </Button>
          ))}
        </div>
      </div>

      <Variant sample={sample} />

      <PrototypeVariantSwitcher label={`${variant} — ${label}`} onCycle={cycle} />
    </div>
  );
}

function Identity({ sample, large = false }: { sample: Sample; large?: boolean }) {
  return <div className="flex items-center gap-4">
    <Avatar className={`${large ? "size-24" : "size-16"} rounded-md after:rounded-md`}><AvatarFallback className="rounded-md text-lg">{sample.photo ? "AT" : sample.initials}</AvatarFallback></Avatar>
    <div className="min-w-0 space-y-1"><h2 className={large ? "text-3xl font-medium" : "text-xl font-medium"}>{sample.name ?? "No name in FACTS"}</h2><p className="text-sm text-muted-foreground">{sample.grade}</p><Badge variant="secondary">{sample.status}</Badge></div>
  </div>;
}

function Fact({ icon: Icon, label, children }: { icon: ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children ?? "—"}</dd></div></div>;
}

function Facts({ sample }: { sample: Sample }) {
  return <dl className="grid gap-5 sm:grid-cols-2">
    <Fact icon={Mail} label="Contact email">{sample.email ? <a className="underline underline-offset-4" href={`mailto:${sample.email}`}>{sample.email}</a> : null}</Fact>
    <Fact icon={GraduationCap} label="Enrolled since">{sample.enrolledSince}</Fact>
    <Fact icon={CalendarDays} label="Birthdate">{sample.birthdate}</Fact>
    <Fact icon={UserRound} label="Age">{sample.age}</Fact>
  </dl>;
}

function Homeroom({ sample, compact = false }: { sample: Sample; compact?: boolean }) {
  if (!sample.homeroom) return <p className="text-sm text-muted-foreground">No homeroom assigned.</p>;
  return <div className={compact ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "space-y-1"}><p className="font-medium">{sample.homeroom.label} <span className="font-normal text-muted-foreground">· {sample.homeroom.room}</span></p><a className="text-sm underline underline-offset-4" href="#staff-prototype">{sample.homeroom.teacher}</a></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }

function VariantA({ sample }: { sample: Sample }) {
  return <div className="mx-auto max-w-3xl space-y-6"><Card><CardContent className="pt-6"><Identity large sample={sample} /></CardContent></Card><div className="grid gap-6 md:grid-cols-[1fr_0.8fr]"><Section title="Enrolment"><Facts sample={sample} /></Section>{sample.homeroom && <Section title="Homeroom"><Homeroom sample={sample} /></Section>}</div></div>;
}

function VariantB({ sample }: { sample: Sample }) {
  return <div className="mx-auto max-w-4xl space-y-6"><Identity sample={sample} /><Section title="Student record"><Facts sample={sample} /></Section>{sample.homeroom && <Section title="Homeroom"><Homeroom sample={sample} compact /></Section>}</div>;
}

function VariantC({ sample }: { sample: Sample }) {
  return <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-6"><Card><CardContent className="pt-6"><Identity large sample={sample} /></CardContent></Card>{sample.homeroom && <Section title="Homeroom"><div className="flex gap-3"><MapPin className="mt-1 size-5 text-muted-foreground" /><Homeroom sample={sample} /></div></Section>}</div><Section title="Enrolment facts"><Facts sample={sample} /></Section></div>;
}
