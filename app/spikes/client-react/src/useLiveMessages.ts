import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export type LiveMessage = { id: string; body: string; sentAtMs: number };
type Row = { id: string | number; body: string; sent_at_ms: number };

export const CHANNEL = "client-spike";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

// "?live=database" listens to new table rows; anything else listens to direct broadcast.
const mode = new URLSearchParams(location.search).get("live") === "database" ? "database" : "broadcast";

export function useLiveMessages() {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const add = (row: Row) =>
      setMessages((old) => [...old, { id: String(row.id), body: row.body, sentAtMs: Number(row.sent_at_ms) }]);

    const channel = supabase.channel(CHANNEL);
    if (mode === "database") {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spike_messages" },
        (change) => add(change.new as Row),
      );
    } else {
      channel.on("broadcast", { event: "message" }, (event) => add(event.payload as Row));
    }
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { messages, connected };
}
