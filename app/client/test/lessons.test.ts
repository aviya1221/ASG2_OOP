import { describe, expect, it } from "vitest";
import { addDays, isCurrent, lectureTitle, lessonsOfWeek, localDay, nowOrNext, shortDate, weekStartOf, type Lesson } from "../src/lessons/lessons.ts";

const NOW = new Date("2026-12-01T10:00:00Z");

function lesson(id: string, startHoursFromNow: number): Lesson {
  const startsAt = new Date(NOW.getTime() + startHoursFromNow * 3_600_000);
  return { id, courseName: "קורס", lectureNumber: 1, topic: null, startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3_600_000) };
}

function at(id: string, iso: string): Lesson {
  const startsAt = new Date(iso);
  return { id, courseName: "קורס", lectureNumber: 1, topic: null, startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3_600_000) };
}

describe("the weekly timetable", () => {
  it("TC-008 opens the week on the Sunday in Israel, also late on a Saturday night in UTC", () => {
    // Tuesday 1 December 2026.
    expect(weekStartOf(NOW)).toBe("2026-11-29");
    // 23:30 UTC on Saturday is already Sunday 01:30 in Israel, so a new week.
    expect(weekStartOf(new Date("2026-12-05T23:30:00Z"))).toBe("2026-12-06");
    expect(localDay(new Date("2026-12-05T23:30:00Z"))).toEqual({ key: "2026-12-06", weekday: 0 });
  });

  it("TC-008 puts each lesson of the week under its day, in order of time, and leaves other weeks out", () => {
    const days = lessonsOfWeek(
      [
        at("tue-late", "2026-12-01T12:00:00Z"),
        at("tue-early", "2026-12-01T06:00:00Z"),
        at("sun", "2026-11-29T08:00:00Z"),
        at("next-week", "2026-12-07T08:00:00Z"),
        at("last-week", "2026-11-26T08:00:00Z"),
      ],
      "2026-11-29",
    );
    expect(days.map((day) => day.map((l) => l.id))).toEqual([["sun"], [], ["tue-early", "tue-late"], [], [], [], []]);
  });

  it("TC-008 offers the lesson happening now, or else the next one, and nothing when all have passed", () => {
    expect(nowOrNext([lesson("soon", 24), lesson("now", -1), lesson("past", -24)], NOW)).toEqual({ lesson: lesson("now", -1), current: true });
    expect(nowOrNext([lesson("far", 48), lesson("soon", 24), lesson("past", -24)], NOW)).toEqual({ lesson: lesson("soon", 24), current: false });
    expect(nowOrNext([lesson("past", -24)], NOW)).toBeNull();
  });

  it("moves between weeks and writes short dates", () => {
    expect(addDays("2026-11-29", 7)).toBe("2026-12-06");
    expect(addDays("2026-11-29", -7)).toBe("2026-11-22");
    expect(shortDate("2026-12-06")).toBe("6.12");
  });
});

describe("isCurrent", () => {
  it("counts the start of a lesson and not its end", () => {
    const item = lesson("x", 0);
    expect(isCurrent(item, item.startsAt)).toBe(true);
    expect(isCurrent(item, item.endsAt)).toBe(false);
  });
});

describe("lectureTitle", () => {
  it("shows the topic when there is one", () => {
    expect(lectureTitle({ lectureNumber: 5, topic: "דרישות" })).toBe("הרצאה 5 · דרישות");
    expect(lectureTitle({ lectureNumber: 5, topic: null })).toBe("הרצאה 5");
  });
});
