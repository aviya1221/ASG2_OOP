import { supabase } from "./supabase.ts";

/** The server can be asleep, and waking it took up to 92 s in the hosting check. */
const TIMEOUT_MS = 120_000;

export class ServerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ServerError";
    this.code = code;
  }
}

async function send(path: string, body: unknown, token: string): Promise<Response> {
  return fetch(`${import.meta.env.VITE_SERVER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Calls our server with the user's sign-in token, and tries once more if the network failed. */
export async function callServer<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ServerError("not_signed_in", "Sign in first.");

  let response: Response;
  try {
    response = await send(path, body, token);
  } catch {
    response = await send(path, body, token);
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) throw new ServerError(json.error ?? "server_error", json.message ?? "");
  return json as T;
}
