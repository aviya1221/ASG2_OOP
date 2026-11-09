import { Route, Routes } from "react-router";
import { SignInPage } from "./accounts/SignInPage.tsx";
import { useSession } from "./accounts/session.tsx";
import { FacePage } from "./attendance/FacePage.tsx";
import { LessonPage } from "./lessons/LessonPage.tsx";
import { LessonsPage } from "./lessons/LessonsPage.tsx";
import { AdminPage } from "./timetable/AdminPage.tsx";

export function App() {
  const session = useSession();

  if (session.status === "loading") return <p className="content">טוען...</p>;
  // Every address needs a sign-in (REQ-01). After it, the same address opens.
  if (session.status === "signed-out") return <SignInPage />;

  const { person } = session;
  return (
    <Routes>
      <Route path="/lessons/:lessonId/:tab?" element={<LessonPage />} />
      <Route path="/face" element={<FacePage person={person} />} />
      <Route path="*" element={person.role === "admin" ? <AdminPage person={person} /> : <LessonsPage person={person} />} />
    </Routes>
  );
}
