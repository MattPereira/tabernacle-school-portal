import { StudentsScreen } from "@/components/students-screen";
import { db } from "@/lib/db/client";
import { groupByGradeLevel, listGradeLevels, listStudents } from "@/lib/students";

// The (portal) layout is this page's only gate — no feature-specific access
// rule. Reads the snapshot, so it never waits on a live FACTS request.
export default async function StudentsPage() {
  const [students, gradeLevels] = await Promise.all([listStudents({ db }), listGradeLevels({ db })]);

  return <StudentsScreen groups={groupByGradeLevel(students, gradeLevels)} />;
}
