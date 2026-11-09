import { defineConfig, devices } from "@playwright/test";

const CLIENT_URL = "http://127.0.0.1:5173";
const SERVER_URL = "http://127.0.0.1:8787";

/** Run through `npm run test:browser`, which sets the addresses and keys of the local database. */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./reports/browser-output",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["junit", { outputFile: "reports/browser.xml" }]],
  use: { baseURL: CLIENT_URL, trace: "retain-on-failure", locale: "he-IL", timezoneId: "Asia/Jerusalem" },
  webServer: [
    {
      command: "npm --prefix client run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      url: CLIENT_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        VITE_SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY ?? "",
        VITE_SERVER_URL: SERVER_URL,
      },
    },
    {
      command: "npm --prefix server run start",
      url: `${SERVER_URL}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: "8787",
        WEB_ORIGIN: CLIENT_URL,
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "",
      },
    },
  ],
  projects: [
    { name: "phone-chromium", use: { ...devices["Pixel 7"] }, grepInvert: /@computer/ },
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] }, grepInvert: /@computer/ },
    { name: "computer-chromium", use: { ...devices["Desktop Chrome"] }, grep: /@computer/ },
  ],
});
