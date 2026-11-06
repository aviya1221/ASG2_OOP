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
