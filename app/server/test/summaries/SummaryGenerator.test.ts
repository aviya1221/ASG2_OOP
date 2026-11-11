import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { FakeLlmClient, LlmError, type LlmJsonRequest } from "../../src/llm/index.ts";
import { SummaryGenerator, summaryWords } from "../../src/summaries/SummaryGenerator.ts";

const TRANSCRIPT = {
  utterances: [
    { time: "00:10", speaker: "מרצה", text: "היום נדבר על הסתברות מותנית" },
    { time: "02:00", speaker: "סטודנט", text: "מה ההבדל מחיתוך?" },
  ],
  on_screen: [{ time: "01:00", content: "P(A|B)" }],
};

const PARTS = (text: string) => ({
  document: `# הסתברות מותנית\n\n${text}\n\n## שאלות מהשיעור\n\n- **מה ההבדל מחיתוך?** המכנה משתנה.`,
  lesson_topic: "הסתברות מותנית",
});

const sound = { extract: async (path: string) => `${path}.m4a` };
const RECORDING = { path: join(tmpdir(), "lesson.mp4"), mimeType: "video/mp4" };

/** Answers each of the three requests in turn: transcript, parts, review. */
function scripted(answers: ((request: LlmJsonRequest<unknown>) => unknown)[]) {
  let call = 0;
  return new FakeLlmClient({ json: (request) => answers[Math.min(call++, answers.length - 1)]!(request) });
}

describe("SummaryGenerator", () => {
  it("TC-083 the first request carries the video and asks for the transcript and the board", async () => {
    const llm = scripted([() => TRANSCRIPT, () => PARTS("תקציר"), () => PARTS("תקציר")]);
    await new SummaryGenerator(llm, sound).generate(RECORDING);

    const upload = llm.calls.find((c) => c.method === "uploadFile")!.input as { mimeType: string };
    assert.equal(upload.mimeType, "video/mp4");
    const first = llm.calls.find((c) => c.method === "generateJson")!.input as LlmJsonRequest<unknown>;
    assert.ok(first.attachments?.length === 1);
    assert.match(first.prompt, /Transcribe/);
    assert.match(first.prompt, /on_screen/);
    assert.deepEqual(llm.openFiles, [], "every uploaded file is deleted");
  });

  it("TC-084 falls back to the sound alone when the file is too large or a usage limit is reached", async () => {
    for (const kind of ["invalid-request", "rate-limit"] as const) {
      const extracted: string[] = [];
      const llm = scripted([
        () => {
          throw new LlmError(kind, "too much");
        },
        (request) => {
          assert.doesNotMatch(request.prompt, /on_screen/);
          return { utterances: TRANSCRIPT.utterances };
        },
        (request) => {
          assert.match(request.prompt, /Board:\n\(none\)/);
          return PARTS("תקציר");
        },
        () => PARTS("תקציר"),
      ]);
      const soundOnly = { extract: async (path: string) => (extracted.push(path), `${path}.m4a`) };
      await new SummaryGenerator(llm, soundOnly).generate(RECORDING);

      assert.deepEqual(extracted, [RECORDING.path], kind);
      const uploads = llm.calls.filter((c) => c.method === "uploadFile").map((c) => (c.input as { mimeType: string }).mimeType);
      assert.deepEqual(uploads, ["video/mp4", "audio/mp4"], kind);
    }
  });

  it("TC-085 asks for one page with headings, bold terms, the board inside its topic and the main questions", async () => {
    const llm = scripted([() => TRANSCRIPT, () => PARTS("פתיחה"), () => PARTS("פתיחה")]);
    await new SummaryGenerator(llm, sound).generate(RECORDING);

    const write = llm.calls.filter((c) => c.method === "generateJson")[1]!.input as LlmJsonRequest<unknown>;
    assert.match(write.prompt, /Markdown/);
    assert.match(write.prompt, /at most 450 words/);
    assert.match(write.prompt, /\*\*bold\*\*/);
    assert.match(write.prompt, /board inside the topic it belongs to/);
    assert.match(write.prompt, /## שאלות מהשיעור/);
  });

  it("TC-085 accepts a summary of 450 words and refuses one of 451, after one more try", async () => {
    // The page adds 9 words around the text: the title, the heading of the questions, and one question with its answer.
    const words = (n: number) => Array.from({ length: n - 9 }, (_, i) => `מילה${i}`).join(" ");
    assert.equal(summaryWords(PARTS(words(450)).document), 450);
    assert.equal(summaryWords("## כותרת\n\n- **מונח** ועוד `x`"), 4, "the marks of Markdown are not words");

    const ok = scripted([() => TRANSCRIPT, () => PARTS(words(450)), () => PARTS(words(450))]);
    const { body } = await new SummaryGenerator(ok, sound).generate(RECORDING);
    assert.equal(summaryWords(body), 450);
    assert.match(body, /^# הסתברות מותנית/);

    const tooLong = scripted([() => TRANSCRIPT, () => PARTS(words(451))]);
    await assert.rejects(new SummaryGenerator(tooLong, sound).generate(RECORDING), { kind: "bad-output" });
    const tries = tooLong.calls.filter((c) => c.method === "generateJson").length;
    assert.equal(tries, 3, "the transcript, then the page twice");
  });

  it("TC-086 the review gets the transcript and the board, and its corrected text is the one kept", async () => {
    let review: LlmJsonRequest<unknown> | undefined;
    const llm = scripted([
      () => TRANSCRIPT,
      () => PARTS("היום דיברנו על הסתברות מותנת"),
      (request) => {
        review = request;
        return PARTS("היום דיברנו על הסתברות מותנית");
      },
    ]);
    const result = await new SummaryGenerator(llm, sound).generate(RECORDING);

    assert.match(review!.prompt, /Correct only spelling mistakes/);
    assert.match(review!.prompt, /היום נדבר על הסתברות מותנית/);
    assert.match(review!.prompt, /P\(A\|B\)/);
    assert.match(result.body, /היום דיברנו על הסתברות מותנית/);
    assert.match(review!.prompt, /keep the headings, bullet points and bold text/);
    assert.equal(result.lessonTopic, "הסתברות מותנית");
  });

  it("deletes the uploaded file at Google also when a request fails", async () => {
    const llm = scripted([
      () => {
        throw new LlmError("unavailable", "overloaded");
      },
    ]);
    await writeFile(RECORDING.path, "x");
    await assert.rejects(new SummaryGenerator(llm, sound).generate(RECORDING), { kind: "unavailable" });
    assert.deepEqual(llm.openFiles, []);
  });
});
