import { createClient } from "@supabase/supabase-js";

/** The one connection to Supabase. It holds only the public key; access rules protect the data. */
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLIC_KEY);
