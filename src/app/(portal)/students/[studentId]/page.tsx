import { notFound } from "next/navigation";

import { StudentDetailScreen } from "@/components/student-detail-screen";
import { db } from "@/lib/db/client";
import { getStudentDetail } from "@/lib/students";

// The portal layout owns staff access. This route only turns an unavailable
// enrolled student into Next's not-found response.
export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  if (!/^\d+$/.test(studentId)) notFound();

  const student = await getStudentDetail({ db, now: () => new Date() }, Number(studentId));
  if (!student) notFound();

  return <StudentDetailScreen student={student} />;
}
