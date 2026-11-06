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

A web app for live lessons: the admin builds the timetable, and each lesson has tabs (attendance, polls and more) that the teacher runs and the students use from their phone's browser.
We deliver it with attendance (including a spreadsheet export) and live polls working in a 10-minute class demo, plus the design documents of steps 2 to 8.

## 1. Objectives

Today's teaching tools are scattered, each with its own login or room code. Our goal is one in-class app that holds everything a lesson needs, shown working live (Assignment 2: design first, reuse code, KISS).

## 2. Deliverables

| ID | Deliverable | Description | Acceptance criterion |
|----|-------------|-------------|----------------------|
| D-1 | Attendance module (main feature) | Students check in from their phones; the teacher downloads a spreadsheet | In the demo, 3 or more phones check in, and the spreadsheet has one row per checked-in student with the check-in time |
| D-2 | Polls module | A multiple-choice poll inside the lesson, with live results ([strategy](features/F3-polls-strategy.md)) | In the demo, 3 or more students answer without entering a code, the chart updates without reloading, and a second answer counts once |
| D-3 | Timetable and roles | Admin, teacher and student views; the admin creates courses | A course with a teacher and 3 students appears for each of them after they log in |
| D-4 | Design documents | Steps 2 to 8: tools report, SRS, use cases, SDD, EDD, STP / STD | The lecturer check reports no errors |

## 3. Scope

### 3.1 In scope

The three roles, the timetable, the attendance and polls tabs, and the design documents. Comments, video summary and homework review are still open (decided in step 1).

### 3.2 Out of scope

Integration with Moodle, Zoom or personal-information systems; a native app; room codes or outside poll sites.

## 4. Milestones

_TODO: the demo date and the checkpoints before it._

## 5. Acceptance criteria

The lecturer is the client. Each deliverable is accepted by its criterion in section 2.

## 6. Assumptions and roles

### 6.1 Assumptions, constraints and dependencies

Students have a smartphone with internet in class. No budget, so every tool needs a free tier. Attendance and polls depend on the tool choice in step 2 offering live updates.

### 6.2 Roles and responsibilities (RACI)

| Activity | Member 1 | Member 2 | Member 3 |
|----------|----------|----------|----------|

### 6.3 Risk register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-1 | The class Wi-Fi fails during the demo | Medium | High | Test on the class network beforehand; keep a phone hotspot and a backup video |
| R-2 | A chosen tool lacks a needed feature | Medium | High | Spike every tool before choosing it; keep a fallback (for polls: livepoll) |
