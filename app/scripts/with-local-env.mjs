/**
 * Runs a command with the addresses and keys of the local Supabase in its environment.
 * Usage: node scripts/with-local-env.mjs <command> [arguments...]
 */
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

function localSupabase() {
  const result = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", shell: isWindows });
  const start = result.stdout?.indexOf("{") ?? -1;
  if (result.status !== 0 || start < 0) {
    console.error(result.stderr || result.stdout);
    console.error("The local database is not running. Start it with: npm run db:start");
    process.exit(1);
  }
  return JSON.parse(result.stdout.slice(start));
}

const status = localSupabase();
const env = {
  ...process.env,
  SUPABASE_URL: status.API_URL,
  SUPABASE_PUBLIC_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  SUPABASE_DB_URL: status.DB_URL,
  LLM_PROVIDER: process.env.LLM_PROVIDER ?? "fake",
};

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-local-env.mjs <command> [arguments...]");
  process.exit(1);
}

const local = new URL(`../node_modules/.bin/${command}${isWindows ? ".cmd" : ""}`, import.meta.url);
const { existsSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const executable = existsSync(local) ? fileURLToPath(local) : command;
const needsQuotes = isWindows && executable.includes(" ");
const run = spawnSync(needsQuotes ? `"${executable}"` : executable, args, { stdio: "inherit", env, shell: isWindows });
process.exit(run.status ?? 1);
