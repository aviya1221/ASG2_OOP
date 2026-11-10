import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkReview, hasMixedScript, REVIEW_RULES, SolutionReviewer } from "../../src/homework/SolutionReviewer.ts";
import { FakeLlmClient, LlmError, type LlmJsonRequest } from "../../src/llm/index.ts";
import { answerOf, guideOf, mark, PDF_BYTES } from "./helpers.ts";

const GUIDE = guideOf({ q1: ["q1_a", "q1_b"], q2: ["q2_a"] });
const FULL = () => answerOf([mark("q1_a", 50), mark("q1_b", 60), mark("q2_a", 70)]);
/** The letter ط inside a Hebrew word, as the spike found it. */
const MIXED = () => answerOf([{ ...mark("q1_a", 50), meets: "הדרך מוסברת בطריקה ברורה" }, mark("q1_b", 60), mark("q2_a", 70)]);

function scripted(answers: (() => unknown)[]) {
  let call = 0;
  return new FakeLlmClient({ json: () => answers[Math.min(call++, answers.length - 1)]!() });
}

const requests = (llm: FakeLlmClient) => llm.calls.map((call) => call.input as LlmJsonRequest<unknown>);

describe("SolutionReviewer", () => {
  it("TC-134 lifts an answered section that got 0 to 1, and leaves a section that was not answered at 0 with no feedback", async () => {
    const llm = scripted([() => answerOf([mark("q1_a", 0, true), { ...mark("q1_b", 0, false), meets: "משהו" }, mark("q2_a", 55)])]);
    const marks = await new SolutionReviewer(llm).review(GUIDE, PDF_BYTES);

    assert.deepEqual(
      marks.map((m) => [m.id, m.answered, m.score]),
      [
        ["q1_a", true, 1],
        ["q1_b", false, 0],
        ["q2_a", true, 55],
      ],
    );
    assert.deepEqual([marks[1]!.meets, marks[1]!.missing, marks[1]!.direction], ["", "", ""]);
  });

  it("TC-134 refuses a score out of range, a missing section, and a score for a section that was not answered", () => {
    const check = checkReview(["q1_a", "q2_a"]);
    assert.throws(() => check(answerOf([mark("q1_a", 101), mark("q2_a", 5)])), /out of range/);
    assert.throws(() => check(answerOf([mark("q1_a", 50.5), mark("q2_a", 5)])), /out of range/);
    assert.throws(() => check(answerOf([mark("q1_a", 50)])), /do not match/);
    assert.throws(() => check(answerOf([mark("q1_a", 50), mark("q1_a", 50)])), /do not match/);
    assert.throws(() => check(answerOf([{ ...mark("q1_a", 30), answered: false }, mark("q2_a", 5)])), /must get 0/);
  });

  it("sends the guide with its instructions, the solution inside the request and the fixed seed", async () => {
    const llm = scripted([FULL]);
    await new SolutionReviewer(llm).review(GUIDE, PDF_BYTES);

    const [request] = requests(llm);
    assert.equal(request!.seed, 20261109);
    assert.ok(request!.instructions!.startsWith(REVIEW_RULES));
    assert.ok(request!.instructions!.includes(GUIDE.system_prompt));
    assert.ok(request!.instructions!.includes(JSON.stringify(GUIDE.questions)));
    assert.deepEqual(request!.attachments, [{ mimeType: "application/pdf", data: PDF_BYTES }]);
    const items = (request!.schema.properties as any).sections;
    assert.deepEqual(items.items.properties.id.enum, ["q1_a", "q1_b", "q2_a"]);
    assert.equal(items.minItems, 3);
    assert.equal(llm.calls.filter((call) => call.method === "uploadFile").length, 0);
  });

  it("asks again with another seed after a rejected answer, because the same seed returns the same answer", async () => {
    const llm = scripted([() => answerOf([mark("q1_a", 50)]), FULL]);
    const marks = await new SolutionReviewer(llm).review(GUIDE, PDF_BYTES);
    assert.equal(marks.length, 3);
    assert.deepEqual(requests(llm).map((request) => request.seed), [20261109, 20261116]);
  });

  it("gives up after the second rejected answer", async () => {
    const llm = scripted([() => answerOf([mark("q1_a", 50)])]);
    await assert.rejects(new SolutionReviewer(llm).review(GUIDE, PDF_BYTES), { name: "LlmError", kind: "bad-output" });
    assert.equal(llm.calls.length, 2);
  });

  it("asks once more when the feedback mixes Arabic letters into Hebrew, and keeps the clean report", async () => {
    const llm = scripted([MIXED, FULL]);
    const marks = await new SolutionReviewer(llm).review(GUIDE, PDF_BYTES);
    assert.equal(hasMixedScript(marks), false);
    assert.deepEqual(requests(llm).map((request) => request.seed), [20261109, 20261116]);
  });

  it("keeps the first report when the second one also mixes the letters, or fails", async () => {
    const twice = scripted([MIXED]);
    const kept = await new SolutionReviewer(twice).review(GUIDE, PDF_BYTES);
    assert.equal(kept[0]!.meets, "הדרך מוסברת בطריקה ברורה");
    assert.equal(twice.calls.length, 2);

    const failing = scripted([
      MIXED,
      () => {
        throw new LlmError("unavailable", "busy", { status: 503 });
      },
    ]);
    assert.equal((await new SolutionReviewer(failing).review(GUIDE, PDF_BYTES))[0]!.meets, "הדרך מוסברת בطריקה ברורה");
  });

  it("leaves feedback written only in Arabic alone, for a homework in Arabic", async () => {
    const llm = scripted([() => answerOf([{ ...mark("q1_a", 50), meets: "الإجابة واضحة" }, mark("q1_b", 60), mark("q2_a", 70)])]);
    await new SolutionReviewer(llm).review(GUIDE, PDF_BYTES);
    assert.equal(llm.calls.length, 1);
  });
});
