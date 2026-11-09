import { createClient } from "@supabase/supabase-js";
import { loadServerConfig } from "./config/env.ts";
import { createApp } from "./http/app.ts";
import { SupabaseUserVerifier } from "./integrations/supabase/SupabaseUserVerifier.ts";

const config = loadServerConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = createApp({ webOrigins: config.webOrigins, verifier: new SupabaseUserVerifier(supabase) });

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server listening on port ${config.port}`);
});
