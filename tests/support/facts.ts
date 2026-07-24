import type { FactsClient, FactsPerson, FactsStaff, FactsStudent } from "@/lib/facts";

export type FactsFixture = {
  students?: FactsStudent[];
  staff?: FactsStaff[];
  people?: FactsPerson[];
  // Make a read blow up, to exercise the failure path.
  failOn?: "students" | "staff" | "people";
};

// Stands in for the real FACTS API at the same seam sync is written against, so
// no test needs a network, a key, or the 10 req/min budget.
export function fakeFacts(fixture: FactsFixture): FactsClient {
  const boom = (which: FactsFixture["failOn"]) => {
    if (fixture.failOn === which) throw new Error(`FACTS ${which} read failed`);
  };

  return {
    async fetchEnrolledStudents() {
      boom("students");
      return fixture.students ?? [];
    },
    async fetchActiveStaff() {
      boom("staff");
      return fixture.staff ?? [];
    },
    async fetchPeople(personIds) {
      boom("people");
      // The real client filters server-side by the ids it was handed; matching
      // that here is what makes the students+staff -> /People join testable.
      const wanted = new Set(personIds);
      return (fixture.people ?? []).filter((p) => wanted.has(p.personId));
    },
  };
}

export const person = (personId: number, firstName: string, lastName: string, contactEmail: string | null = null): FactsPerson => ({
  personId,
  firstName,
  lastName,
  contactEmail,
});

export const student = (studentId: number, gradeLevel = "5"): FactsStudent => ({
  studentId,
  gradeLevel,
  status: "Enrolled",
});

export const staffMember = (staffId: number): FactsStaff => ({ staffId });

// A population of `count` students, ids from `from`, with matching people rows.
export function population(count: number, from = 1000) {
  const students: FactsStudent[] = [];
  const people: FactsPerson[] = [];
  for (let i = 0; i < count; i++) {
    students.push(student(from + i));
    people.push(person(from + i, `First${i}`, `Last${i}`));
  }
  return { students, people };
}
