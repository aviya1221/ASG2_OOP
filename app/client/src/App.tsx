import { SignInPage } from "./accounts/SignInPage.tsx";
import { useSession } from "./accounts/session.tsx";

export function App() {
  const session = useSession();

  if (session.status === "loading") return <p className="content">טוען...</p>;
  // Every address needs a sign-in (REQ-01). After it, the same address opens.
  if (session.status === "signed-out") return <SignInPage />;

  return <p className="content">{session.person.name}</p>;
}
