export type TextPart = { kind: "text"; value: string } | { kind: "link"; value: string };

const ADDRESS = /https?:\/\/[^\s<>"']+/g;
const TRAILING = /[.,;:!?)\]]+$/;

/** Splits a message at web addresses. The page shows every part as text, never as HTML (REQ-27). */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const address = match[0].replace(TRAILING, "");
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    parts.push({ kind: "link", value: address });
    last = start + address.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}
