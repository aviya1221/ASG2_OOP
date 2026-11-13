import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInPage } from "../src/accounts/SignInPage.tsx";
import { isValidEmail, normalEmail } from "../src/accounts/identity.ts";

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn() }));
vi.mock("../src/lib/supabase.ts", () => ({ supabase: { auth } }));

beforeEach(() => {
  auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  auth.signUp.mockReset().mockResolvedValue({ error: null });
});

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("אימייל"), email);
  await user.type(screen.getByLabelText(/סיסמה/), password);
  return user;
}

describe("identity", () => {
  it("keeps an email in small letters with no spaces, and checks its form", () => {
    expect(normalEmail(" Noa.Barak@Example.COM ")).toBe("noa.barak@example.com");
    expect(isValidEmail("noa@example.com")).toBe(true);
    expect(isValidEmail("noa@example")).toBe(false);
    expect(isValidEmail("300000001")).toBe(false);
  });
});

describe("SignInPage", () => {
  it("signs in with the email and the password", async () => {
    render(<SignInPage />);
    const user = await fill("Noa@Example.com", "secret-1");
    await user.click(screen.getByRole("button", { name: "כניסה" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "noa@example.com", password: "secret-1" });
  });

  it("does not call the service for an email that is not complete", async () => {
    render(<SignInPage />);
    const user = await fill("noa", "secret-1");
    await user.click(screen.getByRole("button", { name: "כניסה" }));
    expect(screen.getByRole("alert")).toHaveTextContent("כתובת אימייל מלאה");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows a clear message for a wrong password", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<SignInPage />);
    const user = await fill("noa@example.com", "wrong-password");
    await user.click(screen.getByRole("button", { name: "כניסה" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("האימייל או הסיסמה שגויים");
  });

  it("creates the account on a first sign-in with the email", async () => {
    render(<SignInPage />);
    const user = await fill("noa@example.com", "secret-1");
    await user.click(screen.getByRole("button", { name: "כניסה ראשונה? בחירת סיסמה" }));
    await user.click(screen.getByRole("button", { name: "בחירת סיסמה וכניסה" }));
    expect(auth.signUp).toHaveBeenCalledWith({ email: "noa@example.com", password: "secret-1" });
  });
});
