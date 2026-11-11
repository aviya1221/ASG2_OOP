import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { parentOf, TopBar } from "../src/layout/TopBar.tsx";

vi.mock("../src/lib/supabase.ts", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

function showAt(path: string, role: "teacher" | "student") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar person={{ idNumber: "200000001", name: "ישראל ישראלי", role }} />
    </MemoryRouter>,
  );
}

describe("TopBar", () => {
  it("TC-007 shows the name and role of the signed-in user", () => {
    showAt("/lessons/L1/forum", "teacher");
    const user = screen.getByLabelText("המשתמש המחובר");
    expect(user).toHaveTextContent("ישראל ישראלי");
    expect(user).toHaveTextContent("מרצה");
    expect(screen.getByRole("button", { name: "יציאה" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "רישום פנים" })).toBeNull();
  });

  it("TC-007 gives a student the face registration, and hides the back arrow on the first screen", () => {
    showAt("/", "student");
    expect(screen.getByLabelText("המשתמש המחובר")).toHaveTextContent("סטודנט");
    expect(screen.getByRole("link", { name: "רישום פנים" })).toHaveAttribute("href", "/face");
    expect(screen.queryByRole("button", { name: "חזרה" })).toBeNull();
  });
});

describe("parentOf", () => {
  it("goes one level up when the user came straight to an address", () => {
    expect(parentOf("/")).toBeNull();
    expect(parentOf("/lessons/L1/summary")).toBe("/lessons/L1/forum");
    expect(parentOf("/lessons/L1/forum")).toBe("/");
    expect(parentOf("/face")).toBe("/");
  });
});
