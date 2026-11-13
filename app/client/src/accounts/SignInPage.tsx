import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase.ts";
import { isValidEmail, MIN_PASSWORD_LENGTH, normalEmail } from "./identity.ts";

type Mode = "sign-in" | "first-time";

export function SignInPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setProblem("צריך להקליד כתובת אימייל מלאה.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setProblem(`הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
      return;
    }

    setBusy(true);
    setProblem("");
    const address = normalEmail(email);
    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email: address, password })
        : await supabase.auth.signUp({ email: address, password });
    setBusy(false);

    if (error) {
      setProblem(mode === "sign-in" ? "האימייל או הסיסמה שגויים." : "האימייל לא מופיע ברשימה, או שכבר נבחרה לו סיסמה.");
    }
  }

  function switchMode() {
    setMode(mode === "sign-in" ? "first-time" : "sign-in");
    setProblem("");
  }

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <h1>ניהול שיעורים</h1>
          <p className="band-note">{mode === "sign-in" ? "כניסה למערכת" : "כניסה ראשונה: בחירת סיסמה"}</p>
        </div>
      </header>
      <main className="content narrow">
        <form className="stack" onSubmit={submit} noValidate>
          <label className="field">
            <span>אימייל</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="username" dir="ltr" />
          </label>
          <label className="field">
            <span>{mode === "sign-in" ? "סיסמה" : "סיסמה חדשה"}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              dir="ltr"
            />
          </label>
          {problem && (
            <p className="problem" role="alert">
              {problem}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {mode === "sign-in" ? "כניסה" : "בחירת סיסמה וכניסה"}
          </button>
          <button className="link" type="button" onClick={switchMode}>
            {mode === "sign-in" ? "כניסה ראשונה? בחירת סיסמה" : "יש לי כבר סיסמה"}
          </button>
        </form>
      </main>
    </>
  );
}
