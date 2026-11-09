import type { Page } from "@playwright/test";

/** The made-up people and lessons of supabase/seed.sql and scripts/seed-users.mjs. */
export const ID = { A1: "100000001", T1: "200000001", S1: "300000001", S51: "300000051" } as const;
export const L1 = "11111111-0000-4000-8000-000000000001";
export const PASSWORD = "local-test-password";

export async function signIn(page: Page, idNumber: string, password: string = PASSWORD): Promise<void> {
  await page.getByLabel("תעודת זהות").fill(idNumber);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
}
