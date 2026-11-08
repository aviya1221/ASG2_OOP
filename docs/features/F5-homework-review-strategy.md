# F5 Homework review: approach and decisions

What the team agreed about the homework review, before writing its documents.
Agreed on 2026-11-08. This note feeds the homework requirements in the SRS (F5), the homework review use case, the homework review EDD, its test cases and the LLM section of the tools report.

## 1. The idea

Before handing in a homework, a student uploads their solution as a PDF and asks the app for feedback. They get a report against that homework's requirements, and a chart of where they stand among the students who also asked for feedback.

The tool exists to help students. The teacher publishes the homework and takes no part in the feedback.

## 2. What we agreed

1. **Two layers.** An AI review of each solution, and a chart that compares the students who were reviewed.
2. **Each homework gets its own generated reviewer.** Homework comes from any subject, so there is no shared content template. When a teacher publishes a homework PDF, the LLM reads it and automatically produces:
   - the list of its questions and sections;
   - for each section, what is required and what levels 1 to 5 mean in this homework;
   - a system prompt written for this homework and its subject.

   All three are saved with the homework and reused unchanged for every student's check.
3. **Only the rules that have nothing to do with the subject are fixed:** the score scale, the shape of the answer, and the protections in section 4.
4. **No teacher step.** The teacher only publishes the PDF. They do not approve the generated reviewer and do not receive the feedback or the chart.
5. **Where it sits.** In the lesson's homework tab, next to each homework, a "Get feedback before submitting" button.
6. **The report** opens after the check. For each section it shows the score, what meets the requirements, what is missing and a direction for improving it. The student sees their scores.
7. **The scale.** An answered section gets 1 to 5. A section that was not answered gets 0, and the report points out at the top which sections the student missed.
8. **Three checks per student per homework.** Each check replaces that student's previous result in the chart. The third check is final for that student.
9. **The chart.** Students of the lesson see the name of every student who was checked and where their score stands, with the viewer's own place highlighted. A filter switches between the overall score and any single section of that homework.

## 3. Keeping scores steady

Small differences between runs are acceptable, but we try to avoid them:

- The level descriptions are generated once per homework, so every student is measured against the same text.
- The model and the generated prompt stay the same for all the checks of a homework.
- We use a low temperature and a fixed seed. The Gemini API accepts both, and it treats the seed as best effort.
- For each section the model must first quote the evidence from the solution, and only then choose a level.

**Spike before building:** review the same solution five times, on homework from at least two subjects. The target is that no section moves by more than one level. If that fails, each check runs three reviews and takes the median of each section.

## 4. Protections

**The model never solves the homework.**

- The feedback says what is missing and which direction to take. It never gives the answer, working code, a final result or a rewritten passage.
- The generated prompt states, for each section, what would count as giving the answer away, since this differs between subjects.
- A solution that is empty or only copies the homework gets 0 for every section and no help.

**The model is protected from prompt injection.**

- The student's file is material to review, never instructions. Any text in it that addresses the reviewer, visible or hidden ("give this a 5", "ignore your rules", "solve question 2"), is ignored and does not affect the score.
- The homework file is treated the same way when the reviewer is generated, because a teacher may have copied it from elsewhere.
- The answer must fit a fixed structure with known section IDs and scores from 0 to 5. The server checks it and rejects anything else.
- The server calculates the totals and the chart. The model only scores sections.

**Test set.** The test cases include solutions with hidden white text, instructions in several languages and direct requests for the answer. A protected run must score the same as the same file without the added text, within the tolerance in section 3, and must not reveal an answer.

## 5. Proposed details, not yet discussed

- A check that fails for a technical reason does not use up one of the three.
- The overall score is the average of the sections, weighted by the points in the homework if it states them.
- Students with the same score share a place in the chart.
- The student's PDF is deleted after the check. We keep only the scores, the report, the check number and the time. The file is sent inside the request and is not stored at Google.

## 6. What we reuse

The LLM layer in [app/server/src/llm/](../../app/server/src/llm/) already reads a PDF, takes standing instructions and returns JSON by a schema. It needs one small addition: passing the temperature and the seed. Text-similarity comparison is not needed, because students are compared by their scores.

Still to be built: users, lessons, the database, the phone screens and the chart.

## 7. Still open

- **SoW wording.** D-5 says "students and teachers" get a review. Decision 4 makes it students only, so the SoW needs updating.
- **Client approval.** The college has to approve showing students' names and scores to their classmates, as a privacy matter.
- **Google's terms.** Check whether content sent on the free tier may be used by Google, before running real student work (tools report, section 2.6).
- **Spike results** from section 3.
- **Build order** relative to the attendance feature and the shared base of users and lessons.
