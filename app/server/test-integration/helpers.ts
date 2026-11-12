import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Run through `npm run test:integration` in app/, which sets these for the local database. */
function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Run these tests with: npm run test:integration (in app/)`);
  return value;
}

const URL = env("SUPABASE_URL");
const PUBLIC_KEY = env("SUPABASE_PUBLIC_KEY");
const SECRET_KEY = env("SUPABASE_SECRET_KEY");

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL)) throw new Error(`Refusing to run tests against ${URL}`);

export const PASSWORD = "local-test-password";
export const EMAIL_DOMAIN = "users.lesson.invalid";

/** The made-up people, courses and lessons of supabase/seed.sql. */
export const ID = {
  A1: "100000001",
  T1: "200000001",
  T2: "200000002",
  S1: "300000001",
  S2: "300000002",
  S3: "300000003",
  S51: "300000051",
} as const;
export const COURSE_A = "aaaaaaaa-0000-4000-8000-000000000001";
export const COURSE_B = "bbbbbbbb-0000-4000-8000-000000000002";
export const L1 = "11111111-0000-4000-8000-000000000001";
export const L2 = "22222222-0000-4000-8000-000000000002";
export const L3 = "33333333-0000-4000-8000-000000000003";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

export function publicClient(): SupabaseClient {
  return createClient(URL, PUBLIC_KEY, NO_SESSION);
}

export function secretClient(): SupabaseClient {
  return createClient(URL, SECRET_KEY, NO_SESSION);
}

export function emailFor(idNumber: string): string {
  return `${idNumber}@${EMAIL_DOMAIN}`;
}

export async function signedIn(who: keyof typeof ID): Promise<SupabaseClient> {
  const client = publicClient();
  const { error } = await client.auth.signInWithPassword({ email: emailFor(ID[who]), password: PASSWORD });
  if (error) throw new Error(`Sign-in of ${who} failed: ${error.message}`);
  return client;
}

/** A number no other test run has used. */
export function freshNumber(): string {
  return String(Date.now()).slice(-9);
}
