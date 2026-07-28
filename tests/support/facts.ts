import type {
  FactsClient,
  FactsGradeLevel,
  FactsHomeroom,
  FactsPerson,
  FactsStaff,
  FactsStudent,
} from "@/lib/facts";

export type FactsFixture = {
  students?: FactsStudent[];
  staff?: FactsStaff[];
  people?: FactsPerson[];
  homerooms?: FactsHomeroom[];
  gradeLevels?: FactsGradeLevel[];
  // Make a read blow up, to exercise the failure path.
  failOn?: "students" | "staff" | "people" | "homerooms" | "gradeLevels";
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
    async fetchHomerooms() {
      boom("homerooms");
      return fixture.homerooms ?? [];
    },
    async fetchGradeLevels() {
      boom("gradeLevels");
      return fixture.gradeLevels ?? [];
    },
  };
}

// Contact email, picture and birthdate default to absent; a test that cares
// says so.
export const person = (
  personId: number,
  firstName: string,
  lastName: string,
  profile: Partial<Pick<FactsPerson, "contactEmail" | "pathToPicture" | "birthdate">> = {},
): FactsPerson => ({
  personId,
  firstName,
  lastName,
  contactEmail: null,
  pathToPicture: null,
  birthdate: null,
  ...profile,
});

export const student = (
  studentId: number,
  gradeLevel = "5",
  school: Partial<Pick<FactsStudent, "status" | "enrolledSince">> = {},
): FactsStudent => ({
  studentId,
  gradeLevel,
  status: "Enrolled",
  enrolledSince: null,
  ...school,
});

// Label, room and teacher default to absent — FACTS has homeroom rows carrying
// only some of the three.
export const homeroom = (
  studentId: number,
  assignment: Partial<Omit<FactsHomeroom, "studentId">> = {},
): FactsHomeroom => ({
  studentId,
  homeroom: null,
  room: null,
  staffId: null,
  ...assignment,
});

export const gradeLevel = (gradeLevel: string, sortOrder: number | null = null): FactsGradeLevel => ({
  gradeLevel,
  sortOrder,
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
