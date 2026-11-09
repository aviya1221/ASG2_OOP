import { Route, Routes } from "react-router";
import { SignInPage } from "./accounts/SignInPage.tsx";
import { useSession } from "./accounts/session.tsx";
import { LessonPage } from "./lessons/LessonPage.tsx";
import { LessonsPage } from "./lessons/LessonsPage.tsx";

export function App() {
  const session = useSession();

  if (session.status === "loading") return <p className="content">טוען...</p>;
  // Every address needs a sign-in (REQ-01). After it, the same address opens.
  if (session.status === "signed-out") return <SignInPage />;

  return (
    <Routes>
      <Route path="/lessons/:lessonId/:tab?" element={<LessonPage />} />
      <Route path="*" element={<LessonsPage person={session.person} />} />
    </Routes>
  );
}
