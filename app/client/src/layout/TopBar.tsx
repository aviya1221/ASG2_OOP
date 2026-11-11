import { ArrowRight, Camera, House, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Person, Role } from "../accounts/session.tsx";
import { supabase } from "../lib/supabase.ts";
import { ICON, IconButton, IconLink } from "../ui/Icon.tsx";

export const ROLE_NAMES: Record<Role, string> = { admin: "מנהל", teacher: "מרצה", student: "סטודנט" };

/** Where the back arrow leads when the user came straight to an address: one level up. */
export function parentOf(path: string): string | null {
  if (path === "/") return null;
  const summary = /^\/lessons\/([^/]+)\/summary\/?$/.exec(path);
  return summary ? `/lessons/${summary[1]}/forum` : "/";
}

/** The bar on top of every screen: back, the product name, and who is signed in (REQ-71, UI decision 3). */
export function TopBar({ person, children }: { person: Person; children?: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const parent = parentOf(pathname);

  function back() {
    // React Router counts the pages of this visit, so 0 means the user came straight to this address.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else if (parent) void navigate(parent, { replace: true });
  }

  return (
    <header className="topbar">
      <div className="topbar-side">
        {parent !== null && <IconButton icon={ArrowRight} label="חזרה" onClick={back} />}
        <Link className="topbar-brand" to="/">
          <House {...ICON} />
          <span>ניהול שיעורים</span>
        </Link>
      </div>
      <div className="topbar-side">
        {children}
        <p className="topbar-user" aria-label="המשתמש המחובר">
          <b>{person.name}</b>
          <span>{ROLE_NAMES[person.role]}</span>
        </p>
        {person.role === "student" && <IconLink icon={Camera} label="רישום פנים" to="/face" />}
        <IconButton icon={LogOut} label="יציאה" onClick={() => void supabase.auth.signOut()} />
      </div>
    </header>
  );
}
