import { Route, Routes } from "react-router";
import { SignInPage } from "./accounts/SignInPage.tsx";
import { useSession } from "./accounts/session.tsx";
import { useAttendanceResponder } from "./attendance/AttendanceResponder.ts";
import { FacePage } from "./attendance/FacePage.tsx";
import { TopBar } from "./layout/TopBar.tsx";
import { LessonPage } from "./lessons/LessonPage.tsx";
import { LessonsPage } from "./lessons/LessonsPage.tsx";
import { SummaryPage } from "./summaries/SummaryPage.tsx";
import { TaskIndicator, TaskMessages } from "./tasks/TaskNotices.tsx";
import { AdminPage } from "./timetable/AdminPage.tsx";

export function App() {
  const session = useSession();
  const isStudent = session.status === "signed-in" && session.person.role === "student";
  useAttendanceResponder(isStudent ? session.person.idNumber : null);

  if (session.status === "loading") return <p className="content">טוען...</p>;
  // Every address needs a sign-in (REQ-01). After it, the same address opens.
  if (session.status === "signed-out") return <SignInPage />;

  const { person } = session;
  return (
    <>
      <TopBar person={person}>
        <TaskIndicator />
      </TopBar>
      <Routes>
        <Route path="/lessons/:lessonId/summary" element={<SummaryPage />} />
        <Route path="/lessons/:lessonId/:tab?" element={<LessonPage />} />
        <Route path="/face" element={<FacePage person={person} />} />
        <Route path="*" element={person.role === "admin" ? <AdminPage /> : <LessonsPage />} />
      </Routes>
      <TaskMessages />
    </>
  );
}
