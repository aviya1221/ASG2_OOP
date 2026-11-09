import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase.ts";
import { emailForIdNumber, isValidIdNumber, MIN_PASSWORD_LENGTH } from "./identity.ts";

type Mode = "sign-in" | "first-time";

export function SignInPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidIdNumber(idNumber)) {
      setProblem("תעודת הזהות צריכה להכיל 5 עד 9 ספרות.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setProblem(`הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
      return;
    }

    setBusy(true);
    setProblem("");
    const email = emailForIdNumber(idNumber);
    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { id_number: idNumber.trim() } } });
    setBusy(false);

    if (error) {
      setProblem(mode === "sign-in" ? "תעודת הזהות או הסיסמה שגויים." : "תעודת הזהות לא מופיעה ברשימה, או שכבר נבחרה לה סיסמה.");
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
            <span>תעודת זהות</span>
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} inputMode="numeric" autoComplete="username" dir="ltr" />
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
