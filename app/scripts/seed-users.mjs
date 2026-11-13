/**
 * Creates a sign-in account for every made-up person in the local database.
 * It refuses to run against anything but this computer.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = "local-test-password";

if (!url || !secret) throw new Error("Run this through scripts/with-local-env.mjs");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`Refusing to add test users to ${url}`);

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: people, error } = await supabase.from("people").select("email").is("user_id", null);
if (error) throw error;

const BATCH = 8;
for (let i = 0; i < people.length; i += BATCH) {
  await Promise.all(
    people.slice(i, i + BATCH).map(async ({ email }) => {
      // The database links the new account to the person with this email.
      const { error: createError } = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (createError) throw new Error(`${email}: ${createError.message}`);
    }),
  );
}
console.log(`Created ${people.length} accounts.`);
