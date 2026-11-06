# Technical Tools Report

<!--
LECTURER GUIDELINES: TOOLS REPORT
(Hidden on GitHub, visible when editing.)

Assignment step 2: "Perform a technical-related tools report - make sure to test
(in real life) with any suggested tool."

The slides have no separate "tools report" document. The closest definitions are:

PDR review package (lecture 03a, slide 6):
- Key technology choices, backed by spikes or prototypes
- Alternatives considered and why rejected
- Initial risk register

PDR vs CDR (lecture 03a, slide 8): at the PDR stage, prototypes are
"spikes that reduce technical risk".

Risk register example (lecture 03a, slide 13):
- R1 "Chosen library lacks a needed feature"
  Mitigation: spike before PDR; keep an alternative.
- R4 "External API delivered late"
  Mitigation: mock the API; integrate behind an interface.

SDD "Rationale" (lecture 02a, slide 12): alternatives and why this one.

Docs as code (lecture 02a, slide 21): "Record decisions: short Architecture
Decision Records for each major choice."

Three-point estimate (lecture 03a, slide 12): E = (O + 4M + P) / 6,
useful for "time to set up" per tool.

FOR OUR PROJECT
For every need: list alternatives, run a real spike (a small hands-on test),
save evidence (screenshot in docs/assets/), choose, and write down why the
others were rejected. Keep a fallback for risky choices (LLM / video APIs).
-->

## 1. Evaluation criteria

## 2. Candidate tools by need

### 2.1 Frontend / web framework
### 2.2 Backend / BaaS + realtime database
### 2.3 Spreadsheet export
### 2.4 Attendance check-in method

The method is photo attendance ([interactive mock of the flow](assets/F1-attendance-flow-demo.html)):
1. At a random time the teacher photographs the class. The teacher's page finds the faces and sends only their face-prints, never the photo.
2. Each student's page sends the face-print it saved on the phone at registration.
3. The server compares the face-prints and keeps only the result.
4. Students who are not matched choose their row and seat, and the teacher approves them.

So the need is a face tool that:
- runs inside a web page on a phone, with nothing to install;
- finds the small faces in the back rows of a lecture hall;
- recognises a person whose face is small in the photo;
- is free and open source, with a license that allows use in a product.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. OpenCV | OpenCV.js 4.10 runs the YuNet face finder (2023mar) on the full photo; ONNX Runtime Web 1.31 runs the SFace face-print model (2021dec) | OpenCV and SFace Apache-2.0, YuNet and ONNX Runtime MIT | Spike |
| 2. Human | Human 3.3.6: the BlazeFace face finder and the FaceRes face-print in one library | MIT | Spike |
| 2b. Human + tiles | Option 2, run on overlapping parts of the photo | MIT | Spike |
| face-api.js | Face finder and face-print in one library | MIT | Rejected without a spike: no release since 2020 |
| InsightFace models (SCRFD, ArcFace) | The most accurate open face models | Non-commercial research only | Rejected without a spike: the license |
| AuraFace | Open face-print model | Apache-2.0 | Rejected without a spike: hundreds of MB, too heavy for a phone |
| MediaPipe Face Detector | Face finder only | Apache-2.0 | Rejected without a spike: no face-print |
| DeepFace | Python face library for a server | MIT | Rejected without a spike: the class photo and the registration photos would have to reach the server |
| CompreFace, cloud face services | Ready face-recognition services | Apache-2.0 / paid | Rejected without a spike: they receive photos and store faces in their own database |

### 2.5 Hosting / deployment
### 2.6 LLM API (homework review)
### 2.7 Speech-to-text / video summarization
### 2.8 Vibe-coding tools

## 3. Spikes (hands-on tests)

<!-- One subsection per tool:
### Spike: <tool>
- Goal: what we wanted to check
- What we did: steps
- Result: worked / failed / limits found
- Evidence: ![screenshot](assets/<file>.png)
- Time spent
-->

## 4. Comparison table

| Need | Option | Cost / free tier | Simplicity | Works on phones | Spike result | Chosen? |
|------|--------|------------------|------------|-----------------|--------------|---------|

## 5. Decisions (ADRs)

<!-- One per major choice:
### ADR-n: <title>
- Context: what we needed
- Decision: what we chose
- Alternatives rejected and why
- Consequences: what this means for the design
-->

## 6. Technology risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
