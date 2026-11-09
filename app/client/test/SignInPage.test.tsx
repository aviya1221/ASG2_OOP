import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInPage } from "../src/accounts/SignInPage.tsx";
import { emailForIdNumber, isValidIdNumber } from "../src/accounts/identity.ts";

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn() }));
vi.mock("../src/lib/supabase.ts", () => ({ supabase: { auth } }));

beforeEach(() => {
  auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  auth.signUp.mockReset().mockResolvedValue({ error: null });
});

async function fill(idNumber: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("תעודת זהות"), idNumber);
  await user.type(screen.getByLabelText(/סיסמה/), password);
  return user;
}

describe("identity", () => {
  it("maps an ID number to an address, and checks its form", () => {
    expect(emailForIdNumber(" 300000001 ")).toBe("300000001@users.lesson.invalid");
    expect(isValidIdNumber("1234")).toBe(false);
    expect(isValidIdNumber("123456789")).toBe(true);
    expect(isValidIdNumber("12a456789")).toBe(false);
  });
});

describe("SignInPage", () => {
  it("signs in with the ID number and the password", async () => {
    render(<SignInPage />);
    const user = await fill("300000001", "secret-1");
    await user.click(screen.getByRole("button", { name: "כניסה" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "300000001@users.lesson.invalid", password: "secret-1" });
  });

  it("does not call the service for an ID number that is not valid", async () => {
    render(<SignInPage />);
    const user = await fill("12", "secret-1");
    await user.click(screen.getByRole("button", { name: "כניסה" }));
    expect(screen.getByRole("alert")).toHaveTextContent("5 עד 9 ספרות");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows a clear message for a wrong password", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<SignInPage />);
    const user = await fill("300000001", "wrong-password");
    await user.click(screen.getByRole("button", { name: "כניסה" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("תעודת הזהות או הסיסמה שגויים");
  });

  it("creates the account on a first sign-in, and sends the ID number with it", async () => {
    render(<SignInPage />);
    const user = await fill("300000001", "secret-1");
    await user.click(screen.getByRole("button", { name: "כניסה ראשונה? בחירת סיסמה" }));
    await user.click(screen.getByRole("button", { name: "בחירת סיסמה וכניסה" }));
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "300000001@users.lesson.invalid",
      password: "secret-1",
      options: { data: { id_number: "300000001" } },
    });
  });
});
