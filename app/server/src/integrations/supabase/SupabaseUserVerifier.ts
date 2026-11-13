import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role, SignedInUser, UserVerifier } from "../../http/auth.ts";

/** Checks a sign-in token with Supabase, and finds the person it belongs to. */
export class SupabaseUserVerifier implements UserVerifier {
  readonly #supabase: SupabaseClient;

  /** `supabase` must use the secret key, because it reads the list of people. */
  constructor(supabase: SupabaseClient) {
    this.#supabase = supabase;
  }

  async verify(token: string): Promise<SignedInUser | null> {
    const { data, error } = await this.#supabase.auth.getUser(token);
    if (error || !data.user) return null;

    const { data: person } = await this.#supabase
      .from("people")
      .select("id, role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!person) return null;

    return { userId: data.user.id, personId: person.id as string, role: person.role as Role };
  }
}
