# F5 Homework review: approach and decisions

What the team agreed about the homework review, before writing its documents.
Agreed on 2026-11-08. This note feeds the homework requirements in the SRS (F5), the homework review use case, the homework review EDD, its test cases and the LLM section of the tools report.

## 1. The idea

Before handing in a homework, a student uploads their solution as a PDF and asks the app for feedback. They get a report against that homework's requirements, and a chart of where they stand among the students who also asked for feedback.

The tool exists to help students. The teacher publishes the homework, takes no part in the feedback and can view the chart.

This is a pilot, not a production system, so privacy reviews and outside approvals are out of scope.

## 2. What we agreed

1. **Two layers.** An AI review of each solution, and a chart that compares the students who were reviewed.
2. **Each homework gets its own generated reviewer.** Homework comes from any subject, so there is no shared content template. When a teacher publishes a homework PDF, the LLM reads it and automatically produces:
   - the list of its questions and their sections;
   - for each section, what is required in this homework;
   - a system prompt written for this homework and its subject.

   All three are saved with the homework and reused unchanged for every student's check.
3. **Only the rules that have nothing to do with the subject are fixed:** the score scale, the shape of the answer, and the protections in section 4.
4. **No teacher approval.** The teacher publishes the PDF and can view the chart. They do not approve the generated reviewer and do not receive the feedback.
5. **Where it sits.** In the lesson's homework tab, next to each homework, a "Get feedback before submitting" button.
6. **The report** opens after the check. For each section it shows the score, what meets the requirements, what is missing and a direction for improving it. The student sees their scores.
7. **The scale.** An answered section gets one number from 1 to 100. A section that was not answered gets 0, and the report points out at the top which sections the student missed.
8. **The overall score.** A question's score is the plain average of its sections, and the overall score is the plain average of all the questions. Points stated in the homework do not change this. The result is rounded and never goes below 1.
9. **Three checks per student per homework.** Each check replaces that student's previous result in the chart. The third check is final for that student.
10. **The chart.** The students of the lesson and its teacher see the name of every student who was checked and where their score stands. A student's own place is highlighted. A filter switches between the overall score, any question and any section of that homework.

## 3. Keeping scores steady

Small differences between runs are acceptable, but we try to avoid them:

- The section requirements are generated once per homework, so every student is measured against the same text.
- The model and the generated prompt stay the same for all the checks of a homework.
- We use a fixed seed, which the Gemini API treats as best effort. We set no temperature: Gemini 3.6 and later ignore it, and the spike measured both models without it.
- A retry after a rejected answer uses another seed, because the same seed returns the same answer.
- For each section the model must first quote the evidence from the solution, and only then give the score.

**Spike result:** with `gemini-3.5-flash-lite` and the stricter wording, the overall score of the same solution moved by up to 9 points between seeds, and one section by up to 35. The median of three reviews is dropped: it triples the requests and still moved a section by 25 points. The model is chosen in [ADR-9](../02-tools-report.md#adr-9-model-for-the-homework-review).

## 4. Protections

**The model never solves the homework.**

- The feedback says what is missing and which direction to take. It never gives the answer, working code, a final result or a rewritten passage.
- The generated prompt states, for each section, what would count as giving the answer away, since this differs between subjects.
- A solution that is empty or only copies the homework gets 0 for every section and no help.

**The model is protected from prompt injection.**

- The student's file is material to review, never instructions. Any text in it that addresses the reviewer, visible or hidden ("give this 100", "ignore your rules", "solve question 2"), is ignored and does not affect the score.
- The homework file is treated the same way when the reviewer is generated, because a teacher may have copied it from elsewhere.
- The answer must fit a fixed structure with known section IDs and scores from 0 to 100. The server checks it and rejects anything else.
- The server calculates the totals and the chart. The model only scores sections.
- An answered section that gets 0 from the model is lifted to 1 by the server.
- A report with Arabic letters inside Hebrew words is asked for again once, with another seed.

**Test set.** The test cases include solutions with hidden white text, instructions in several languages and direct requests for the answer. Over 3 reviews, the added text must not raise the median score of a section by more than 10 points compared with the same file without it (NFR-01), and no report may reveal an answer.

## 5. Further details

- A check that fails for a technical reason does not use up one of the three.
- Students with the same score share a place in the chart.
- The student's PDF is deleted within 1 minute of the end of the check. We keep only the scores, the report, the check number and the time. The file is sent inside the request and is not stored at Google.

## 6. What we reuse

The LLM layer in [app/server/src/llm/](../../app/server/src/llm/) already reads a PDF, takes standing instructions and returns JSON by a schema. It needs one small addition: passing the seed. Text-similarity comparison is not needed, because students are compared by their scores.

Still to be built: the homework tables, the homework tab and the chart.

## 7. Still open

Nothing. The spike is done, and the homework review is built last.
