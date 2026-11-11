import { expect, test } from "@playwright/test";
import { ID, L1, signIn } from "./helpers.ts";

test("TC-001 refuse a lesson without signing in, and refuse a wrong password", async ({ page }) => {
  await page.goto(`/lessons/${L1}`);
  await expect(page.getByRole("button", { name: "כניסה", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "לשוניות השיעור" })).toHaveCount(0);

  await signIn(page, ID.S1, "wrong-password");
  await expect(page.getByRole("alert")).toHaveText("תעודת הזהות או הסיסמה שגויים.");
});

test("TC-002 the admin creates a course, and the same number is refused @computer", async ({ page }) => {
  const number = String(Date.now()).slice(-7);

  await page.goto("/");
  await signIn(page, ID.A1);
  await expect(page.getByRole("heading", { name: "מערכת שעות" })).toBeVisible();

  async function fillForm() {
    await page.getByLabel("מספר קורס").fill(number);
    await page.getByLabel("שם הקורס").fill("הנדסת תוכנה");
    await page.getByLabel("תעודת זהות של המרצה").fill(ID.T1);
    await page.getByLabel("שם המרצה").fill("מרצה ראשון");
    await page.getByLabel("תאריך התחלה").fill("2027-02-07");
    await page.getByLabel(/סטודנטים/).fill(`${ID.S1} סטודנט 1\n300000002 סטודנט 2\n300000003 סטודנט 3`);
    await page.getByRole("button", { name: "שמירת הקורס" }).click();
  }

  await fillForm();
  await expect(page.getByRole("status")).toHaveText(`הקורס ${number} נשמר.`);
  await expect(page.getByRole("region", { name: "מערכת השעות השבועית" })).toContainText("הנדסת תוכנה");

  await fillForm();
  await expect(page.getByRole("alert")).toHaveText("מספר הקורס הזה כבר קיים.");
});

test("TC-002 the form says what to fix before saving @computer", async ({ page }) => {
  await page.goto("/");
  await signIn(page, ID.A1);
  await page.getByRole("button", { name: "שמירת הקורס" }).click();
  await expect(page.getByRole("alert")).toContainText("חסר מספר קורס.");
  await expect(page.getByRole("alert")).toContainText("חסרה רשימת סטודנטים.");
});

test("TC-005 reach a lesson with no code, on one page with three tabs", async ({ page }) => {
  await page.goto("/");
  await signIn(page, ID.S1);
  await expect(page.getByRole("heading", { name: "השיעורים שלי" })).toBeVisible();

  const current = page.getByRole("link", { name: /עכשיו/ }).first();
  await expect(current).toContainText("קורס א");
  await current.click();

  const tabs = page.getByRole("navigation", { name: "לשוניות השיעור" });
  await expect(tabs.getByRole("link")).toHaveText(["נוכחות", "פורום", "מטלות"]);

  for (const name of ["פורום", "מטלות", "נוכחות"]) {
    await tabs.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
    await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "קורס א", level: 1 })).toBeVisible();
  }
  await expect(page.getByText(/קוד/)).toHaveCount(0);
});

test("UC-08 a signed-in user returns to the address they asked for", async ({ page }) => {
  await page.goto(`/lessons/${L1}`);
  await signIn(page, ID.S1);
  await expect(page.getByRole("navigation", { name: "לשוניות השיעור" })).toBeVisible();
});

test("UC-08 a student cannot open a lesson of another course", async ({ page }) => {
  await page.goto(`/lessons/${L1}`);
  await signIn(page, ID.S51);
  await expect(page.getByText("השיעור הזה לא נמצא.")).toBeVisible();
});

test("TC-008 the first screen is a weekly timetable that moves between weeks, with today's lesson in it", async ({ page }) => {
  await page.goto("/");
  await signIn(page, ID.S1);
  const timetable = page.getByRole("region", { name: "מערכת השעות" });
  await expect(timetable.getByRole("link", { name: /קורס א/ }).first()).toBeVisible();

  const title = timetable.getByRole("heading", { level: 2 });
  const thisWeek = await title.textContent();
  await timetable.getByRole("button", { name: "השבוע הבא" }).click();
  await expect(title).not.toHaveText(thisWeek!);
  await timetable.getByRole("button", { name: "השבוע", exact: true }).click();
  await expect(title).toHaveText(thisWeek!);
});
