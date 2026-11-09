import { describe, expect, it } from "vitest";
import { isCurrent, lectureTitle, orderLessons, type Lesson } from "../src/lessons/lessons.ts";

const NOW = new Date("2026-12-01T10:00:00Z");

function lesson(id: string, startHoursFromNow: number): Lesson {
  const startsAt = new Date(NOW.getTime() + startHoursFromNow * 3_600_000);
  return { id, courseName: "קורס", lectureNumber: 1, topic: null, startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3_600_000) };
}

describe("orderLessons", () => {
  it("puts the current lesson first, then the coming ones, then the past ones", () => {
    const ordered = orderLessons([lesson("long-past", -48), lesson("past", -24), lesson("far", 48), lesson("now", -1), lesson("soon", 24)], NOW);
    expect(ordered.map((l) => l.id)).toEqual(["now", "soon", "far", "past", "long-past"]);
  });

  it("does not change the list it was given", () => {
    const original = [lesson("past", -24), lesson("now", -1)];
    orderLessons(original, NOW);
    expect(original.map((l) => l.id)).toEqual(["past", "now"]);
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
