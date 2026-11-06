# Step 3: Scope of Work (SoW)

<!--
LECTURER GUIDELINES: SCOPE OF WORK (lecture 02a, slides 3, 4, 22)
(Hidden on GitHub, visible when editing.)

"Scope of Work: the agreement before the code."
Answers: What is delivered, when, at what cost?
Written by: project manager, client. Read by: client, management, team.
When: before the project starts.
Cheat sheet: what we deliver, when, for how much, and how it is accepted.

Six parts:
1. Objectives: business problem, goals and background of the project
2. Deliverables: concrete outputs (software, documents, training, support)
3. In and out of scope: what is included, and explicitly what is not
4. Milestones: phases, dates and payment points
5. Acceptance criteria: how the client decides each deliverable is done
6. Assumptions and roles: constraints, dependencies, who does what

Common pitfalls:
- Vague deliverables: "a working system" cannot be accepted or rejected
- No acceptance test: delivery turns into an argument
- No out-of-scope list: every new idea becomes "included"

Traceability (slide 19): deliverables get IDs (e.g. "D-2 Loan module") so the
SRS requirements can trace back to them.

Tools from lecture 03a (Software Project Management):
- Milestones: work breakdown, then a Gantt chart (slide 11).
- Estimates: three-point estimate E = (O + 4M + P) / 6 (slide 12).
  Example: optimistic 3 days, most likely 5, pessimistic 13, so E = 6 days.
- Risks (slide 13): risk matrix (probability x impact, low / med / high) and a
  register: ID | Risk | Mitigation. Lecturer's examples:
    R1 Chosen library lacks a needed feature: spike before PDR; keep an alternative
    R2 Team members unavailable in exam weeks: plan lighter sprints; pair on key parts
    R3 Scope creep from new requests: change requests go through the PRD owner
    R4 External API delivered late: mock the API; integrate behind an interface
    R5 Loss of code or data: remote repository, CI and backups
- Roles (slide 14): RACI table per activity
  (R = responsible, A = accountable, C = consulted, I = informed).
  Lecturer's activities: PRD, architecture and SDD, implementation, testing,
  design reviews, demo and acceptance.
  Meeting rhythm: daily stand-up, weekly status, review every sprint.
  Tools: Jira or GitHub Projects, Git, Slack or Teams.

FOR OUR PROJECT
There are no payments; milestones are dates and checkpoints up to the demo.
Mermaid supports `gantt` charts, which GitHub renders.
-->

## 1. Objectives

## 2. Deliverables

| ID | Deliverable | Description | Acceptance criterion |
|----|-------------|-------------|----------------------|

## 3. Scope

### 3.1 In scope

### 3.2 Out of scope

## 4. Milestones

<!-- Table: milestone | date | deliverables (D-n). Then a Mermaid gantt chart. -->

## 5. Acceptance criteria

## 6. Assumptions and roles

### 6.1 Assumptions, constraints and dependencies

### 6.2 Roles and responsibilities (RACI)

| Activity | Member 1 | Member 2 | Member 3 |
|----------|----------|----------|----------|

### 6.3 Risk register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
