import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScoreCalculator } from "../../src/homework/ScoreCalculator.ts";
import { guideOf, mark } from "./helpers.ts";

const scores = new ScoreCalculator();

describe("ScoreCalculator", () => {
  it("TC-135 averages the sections of each question, and the questions, whatever points the homework states", () => {
    const guide = guideOf({ q1: ["q1_a", "q1_b"], q2: ["q2_a"] });
    const questions = scores.questionScores(guide, [mark("q1_a", 80), mark("q1_b", 61), mark("q2_a", 0)]);

    assert.deepEqual(questions, [
      { id: "q1", question: 1, score: 70.5 },
      { id: "q2", question: 2, score: 0 },
    ]);
    assert.equal(scores.overall(questions), 35);
  });

  it("TC-135 rounds the overall score to a whole number and never goes below 1", () => {
    const of = (...values: number[]) => values.map((score, index) => ({ id: `q${index + 1}`, question: index + 1, score }));
    assert.equal(scores.overall(of(70.5, 71)), 71);
    assert.equal(scores.overall(of(70.4, 70.4)), 70);
    assert.equal(scores.overall(of(0, 0)), 1);
    assert.equal(scores.overall(of(0.4)), 1);
  });

  it("gives a question whose sections were all left blank a score of 0", () => {
    const guide = guideOf({ q1: ["q1_a", "q1_b"] });
    assert.deepEqual(scores.questionScores(guide, [mark("q1_a", 0), mark("q1_b", 0)]), [{ id: "q1", question: 1, score: 0 }]);
  });
});
