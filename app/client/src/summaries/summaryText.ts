export interface SummaryParts {
  overview: string;
  topics: { title: string; start: string }[];
  questions: { time: string; question: string; answer: string }[];
  board: { time: string; content: string }[];
}

export const STALE_AFTER_MS = 15 * 60_000;

/** A summary in progress for more than 15 minutes is shown as failed: the free server may have stopped. */
export function isStale(startedAt: Date, now: Date): boolean {
  return now.getTime() - startedAt.getTime() > STALE_AFTER_MS;
}

const TIME = /^(\d{1,2}:\d{2})\s+(.*)$/;

function timedLine(line: string): [string, string] {
  const match = TIME.exec(line.trim());
  return match ? [match[1]!, match[2]!.trim()] : ["", line.trim()];
}

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/** The four parts as text the teacher can edit, one item per line (REQ-47). */
export function toEditable(parts: SummaryParts): Record<keyof SummaryParts, string> {
  return {
    overview: parts.overview,
    topics: parts.topics.map((t) => `${t.start} ${t.title}`.trim()).join("\n"),
    questions: parts.questions.map((q) => [q.time, q.question, q.answer].join(" | ")).join("\n"),
    board: parts.board.map((b) => `${b.time} ${b.content}`.trim()).join("\n"),
  };
}

export function fromEditable(text: Record<keyof SummaryParts, string>): SummaryParts {
  return {
    overview: text.overview.trim(),
    topics: lines(text.topics).map((line) => {
      const [start, title] = timedLine(line);
      return { start, title };
    }),
    questions: lines(text.questions).map((line) => {
      const [time = "", question = "", answer = ""] = line.split("|").map((part) => part.trim());
      return { time, question, answer };
    }),
    board: lines(text.board).map((line) => {
      const [time, content] = timedLine(line);
      return { time, content };
    }),
  };
}
