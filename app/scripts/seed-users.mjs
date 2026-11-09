/**
 * Creates a sign-in account for every made-up person in the local database.
 * It refuses to run against anything but this computer.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = "local-test-password";
const EMAIL_DOMAIN = "users.lesson.invalid";

if (!url || !secret) throw new Error("Run this through scripts/with-local-env.mjs");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`Refusing to add test users to ${url}`);

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: people, error } = await supabase.from("people").select("id_number").is("user_id", null);
if (error) throw error;

const BATCH = 8;
for (let i = 0; i < people.length; i += BATCH) {
  await Promise.all(
    people.slice(i, i + BATCH).map(async ({ id_number }) => {
      const { error: createError } = await supabase.auth.admin.createUser({
        email: `${id_number}@${EMAIL_DOMAIN}`,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { id_number },
      });
      if (createError) throw new Error(`${id_number}: ${createError.message}`);
    }),
  );
}
console.log(`Created ${people.length} accounts.`);
