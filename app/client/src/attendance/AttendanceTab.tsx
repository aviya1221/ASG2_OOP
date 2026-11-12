import { useSession } from "../accounts/session.tsx";
import { StudentAttendance } from "./StudentAttendance.tsx";
import { TeacherAttendance } from "./TeacherAttendance.tsx";

export function AttendanceTab({ lessonId }: { lessonId: string }) {
  const session = useSession();
  if (session.status !== "signed-in") return null;
  return session.person.role === "teacher" ? <TeacherAttendance lessonId={lessonId} /> : <StudentAttendance lessonId={lessonId} person={session.person} />;
}
