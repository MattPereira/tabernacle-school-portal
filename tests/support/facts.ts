import type { FactsClient, FactsPerson, FactsStaff, FactsStudent } from "@/lib/facts";

export type FactsFixture = {
  students?: FactsStudent[];
  staff?: FactsStaff[];
  people?: FactsPerson[];
  // Make a read blow up, to exercise the failure path.
  failOn?: "students" | "staff" | "people";
};

// Stands in for the real FACTS API at the same seam sync is written against, so
// no test needs a network, a key, or the 100 req/min budget.
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

// Contact email and picture default to absent; a test that cares says so.
export const person = (
  personId: number,
  firstName: string,
  lastName: string,
  profile: Partial<Pick<FactsPerson, "contactEmail" | "pathToPicture">> = {},
): FactsPerson => ({
  personId,
  firstName,
  lastName,
  contactEmail: null,
  pathToPicture: null,
  ...profile,
});

export const student = (studentId: number, gradeLevel = "5"): FactsStudent => ({
  studentId,
  gradeLevel,
  status: "Enrolled",
});

// Name parts and department default to absent; a test that cares says so.
export const staffMember = (
  staffId: number,
  profile: Partial<Omit<FactsStaff, "staffId">> = {},
): FactsStaff => ({
  staffId,
  firstName: null,
  middleName: null,
  lastName: null,
  department: null,
  ...profile,
});

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
