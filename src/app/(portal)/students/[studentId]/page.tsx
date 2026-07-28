import { notFound } from "next/navigation";

import { StudentDetailScreen } from "@/components/student-detail-screen";
import { StudentDetailDataPrototype } from "@/components/student-detail-data-prototype";
import { db } from "@/lib/db/client";
import { getStudentDetail } from "@/lib/students";

// The portal layout owns staff access. This route only turns an unavailable
// enrolled student into Next's not-found response.
export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { studentId } = await params;
  if (!/^\d+$/.test(studentId)) notFound();

  const student = await getStudentDetail({ db, now: () => new Date() }, Number(studentId));
  if (!student) notFound();

  // Prototype only: production retains the settled detail screen even if a
  // shared URL includes a stale variant parameter.
  if (process.env.NODE_ENV !== "production" && (await searchParams).variant) {
    return <StudentDetailDataPrototype student={student} />;
  }

  return <StudentDetailScreen student={student} />;
}
