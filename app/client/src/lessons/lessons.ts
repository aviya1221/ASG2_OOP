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

/** The current lesson first, then the coming lessons from the nearest, then the past ones from the latest. */
export function orderLessons(lessons: Lesson[], now: Date): Lesson[] {
  const rank = (lesson: Lesson) => (isCurrent(lesson, now) ? 0 : lesson.startsAt > now ? 1 : 2);
  return [...lessons].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    const byTime = a.startsAt.getTime() - b.startsAt.getTime();
    return rank(a) === 2 ? -byTime : byTime;
  });
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
