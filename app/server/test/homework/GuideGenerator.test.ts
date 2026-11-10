import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GUIDE_RULES, GuideGenerator } from "../../src/homework/GuideGenerator.ts";
import { FakeLlmClient, LlmError, type LlmJsonRequest } from "../../src/llm/index.ts";
import { guideOf, PDF_BYTES } from "./helpers.ts";

const GUIDE = guideOf({ q1: ["q1_a", "q1_b"], q2: ["q2_a"] });

/** Answers each request in turn with the next answer, then repeats the last one. */
function scripted(answers: (() => unknown)[]) {
  let call = 0;
  return new FakeLlmClient({ json: () => answers[Math.min(call++, answers.length - 1)]!() });
}

const requests = (llm: FakeLlmClient) => llm.calls.map((call) => call.input as LlmJsonRequest<unknown>);

describe("GuideGenerator", () => {
  it("TC-131 makes the guide with one request that carries the PDF inside it and the fixed seed", async () => {
    const llm = scripted([() => ({ subject: "הסתברות", ...GUIDE })]);
    const guide = await new GuideGenerator(llm).generate(PDF_BYTES);

    assert.deepEqual(guide, GUIDE);
    assert.equal(llm.calls.length, 1);
    const [request] = requests(llm);
    assert.equal(request!.instructions, GUIDE_RULES);
    assert.equal(request!.seed, 20261109);
    assert.deepEqual(request!.attachments, [{ mimeType: "application/pdf", data: PDF_BYTES }]);
  });

  it("TC-131 asks once more, with another seed, for a guide of the wrong shape", async () => {
    const llm = scripted([() => ({ subject: "הסתברות", questions: [], system_prompt: "" }), () => ({ subject: "הסתברות", ...GUIDE })]);
    assert.deepEqual(await new GuideGenerator(llm).generate(PDF_BYTES), GUIDE);
    assert.deepEqual(requests(llm).map((request) => request.seed), [20261109, 20261116]);
  });

  it("refuses a guide with a repeated section id or a question with no sections, after the second try", async () => {
    const repeated = guideOf({ q1: ["q1_a", "q1_a"] });
    const llm = scripted([() => repeated]);
    await assert.rejects(new GuideGenerator(llm).generate(PDF_BYTES), { name: "LlmError", kind: "bad-output" });
    assert.equal(llm.calls.length, 2);

    const empty = scripted([() => ({ questions: [{ id: "q1", title: "שאלה 1", sections: [] }], system_prompt: "" })]);
    await assert.rejects(new GuideGenerator(empty).generate(PDF_BYTES), { name: "LlmError", kind: "bad-output" });
  });

  it("does not ask again when the AI service is unavailable", async () => {
    const llm = scripted([
      () => {
        throw new LlmError("unavailable", "busy", { status: 503 });
      },
    ]);
    await assert.rejects(new GuideGenerator(llm).generate(PDF_BYTES), { name: "LlmError", kind: "unavailable" });
    assert.equal(llm.calls.length, 1);
  });
});
