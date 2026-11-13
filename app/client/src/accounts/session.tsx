import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase.ts";

export type Role = "admin" | "teacher" | "student";

export interface Person {
  /** The internal id that every table points to. No screen shows it. */
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type Session = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; person: Person };

const SessionContext = createContext<Session>({ status: "loading" });

export function useSession(): Session {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [person, setPerson] = useState<Person | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setPerson(null);
      return;
    }
    let active = true;
    void supabase
      .from("people")
      .select("id, email, name, role")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (active && data) setPerson({ id: data.id, email: data.email, name: data.name, role: data.role as Role });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const session = useMemo<Session>(() => {
    if (userId === undefined || (userId && !person)) return { status: "loading" };
    return person ? { status: "signed-in", person } : { status: "signed-out" };
  }, [userId, person]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
