export interface Lesson {
  id: string;
  courseName: string;
  lectureNumber: number;
  topic: string | null;
  startsAt: Date;
  endsAt: Date;
}

export function isCurrent(lesson: Lesson, now: Date): boolean {
  return lesson.startsAt <= now && now < lesson.endsAt;
}

export function lectureTitle(lesson: Pick<Lesson, "lectureNumber" | "topic">): string {
  return lesson.topic ? `הרצאה ${lesson.lectureNumber} · ${lesson.topic}` : `הרצאה ${lesson.lectureNumber}`;
}

const WHEN = new Intl.DateTimeFormat("he-IL", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

export function formatWhen(date: Date): string {
  return WHEN.format(date);
}

const LOCAL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The date in Israel as "YYYY-MM-DD", and its day of the week from Sunday (0) to Saturday (6). */
export function localDay(date: Date): { key: string; weekday: number } {
  const parts = Object.fromEntries(LOCAL_DAY.formatToParts(date).map((part) => [part.type, part.value]));
  return { key: `${parts.year}-${parts.month}-${parts.day}`, weekday: WEEKDAYS.indexOf(parts.weekday!) };
}

/** Moves a "YYYY-MM-DD" date by whole days. */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/** The Sunday that opens the week of this moment, in Israel (REQ-72). */
export function weekStartOf(date: Date): string {
  const { key, weekday } = localDay(date);
  return addDays(key, -weekday);
}

/** The lessons of the week that opens on `weekStart`, one list per day from Sunday to Saturday, each in order of time. */
export function lessonsOfWeek(lessons: Lesson[], weekStart: string): Lesson[][] {
  const days: Lesson[][] = Array.from({ length: 7 }, () => []);
  for (const lesson of lessons) {
    const { key, weekday } = localDay(lesson.startsAt);
    if (addDays(key, -weekday) === weekStart) days[weekday]!.push(lesson);
  }
  for (const day of days) day.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return days;
}

/** The lesson happening now, or else the next one, which the first screen opens in one tap (REQ-72). */
export function nowOrNext(lessons: Lesson[], now: Date): { lesson: Lesson; current: boolean } | null {
  const current = lessons.find((lesson) => isCurrent(lesson, now));
  if (current) return { lesson: current, current: true };
  const next = lessons.filter((lesson) => lesson.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  return next ? { lesson: next, current: false } : null;
}

const TIME = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

export function formatTime(date: Date): string {
  return TIME.format(date);
}

/** "9.11" for the date "2026-11-09". */
export function shortDate(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${day}.${month}`;
}
