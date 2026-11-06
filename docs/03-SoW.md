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

**Problem.** Today's online teaching tools don't serve a live class well. Each one is a separate service with its own login or room code, so attendance, polls and student feedback end up scattered across several tools.

**Goals.**

1. One web app for the classroom that students open in their phone's browser. Everything that happens in a lesson lives under that lesson.
2. Attendance is the main feature: students mark their attendance from their phones, and the teacher gets a spreadsheet.
3. A teacher can run a quick poll during a live lesson and see the answers as they come in.
4. Show it working in a real 10-minute demo in this class.

**Background.** This is Assignment 2 of Introduction to Software Engineering (OOP, OOD). It is a design challenge first. Reusing existing code is preferred over writing everything from scratch, and the design must stay simple (KISS).

## 2. Deliverables

| ID | Deliverable | Description | Acceptance criterion |
|----|-------------|-------------|----------------------|
| D-1 | Attendance module (main feature) | Attendance tab in the lesson: students mark their attendance from their phones, and the teacher downloads the lesson's attendance spreadsheet | In the demo, students check in from at least 3 different phones, and the downloaded spreadsheet has one row per checked-in student, with the lesson and the check-in time |
| D-2 | Polls module | Polls tab in the lesson: the teacher opens a multiple-choice poll during the lesson, the lesson's students answer inside the app, and results show live. Strategy: [F3-polls-strategy.md](features/F3-polls-strategy.md) | In the demo, at least 3 students answer from their phones without entering any code, the teacher's chart updates without reloading the page, and a student who answers twice is counted once |
| D-3 | Timetable and roles | Admin, teacher and student views. The admin creates a course with its teacher, weekly hours and students, and each lesson page has one tab per feature | The admin creates a course with a teacher and 3 students; after logging in, the teacher and each of the students see that lesson with its tabs |
| D-4 | Deployed web app | A public URL that opens in a phone browser with nothing to install, plus the README quick start | The URL opens on an Android phone and on an iPhone, and a teammate runs the app locally by following only the README quick start |
| D-5 | Technical tools report | Candidate tools per need, a hands-on spike for each, a comparison table, decisions (ADRs) and risks: [02-tools-report.md](02-tools-report.md) | Every recommended tool has a spike with a screenshot, and every major choice has an ADR |
| D-6 | SRS | Functional and non-functional requirements with a traceability matrix: [04-SRS.md](04-SRS.md) | Every requirement reads "The system shall...", has a priority and traces to a deliverable, and every non-functional requirement has a number and a unit |
| D-7 | Use cases | Main use cases with a use-case diagram: [05-use-cases.md](05-use-cases.md) | Every use case has the lecturer's 6 fields, and every in-scope requirement is covered by a use case |
| D-8 | SDD | System components, interfaces, data, deployment and rationale: [06-SDD.md](06-SDD.md) | Every requirement is allocated to a component |
| D-9 | EDD per component | Class and sequence diagrams, one file per component: [07-EDD/](07-EDD/) | Every SDD component has an EDD file with the 8 sections, a class diagram and at least one sequence diagram |
| D-10 | STP / STD | Test plan and test cases: [08-STP-STD.md](08-STP-STD.md) | Every EDD class has a planned test, and every in-scope requirement has at least one test case |
| D-11 | Live demo in class | A 10-minute demo on real phones: [10-demo-plan.md](10-demo-plan.md) | It ends within 10 minutes, and every live step maps to a use case or a requirement |
| D-12 | Conclusion | A short summary of the results: [11-conclusion.md](11-conclusion.md) | It compares every deliverable in this table with what was actually delivered |

Comments and suggestions, the class video summary and the homework review get their deliverable IDs once step 1 decides whether each one is built for the demo or designed only.

## 3. Scope

Comments and suggestions, the class video summary and the homework review are not placed yet. Step 1 decides whether each one is built for the demo, designed only, or left out.

### 3.1 In scope

- A web app that runs in the phone's browser, with three roles: admin, teacher and student (D-3, D-4).
- A timetable built by the admin: courses, their teachers, weekly hours and students (D-3).
- A lesson page with one tab per feature (D-3).
- Attendance with a spreadsheet export, as the main feature (D-1).
- Live multiple-choice polls inside the lesson (D-2).
- The design documents of steps 2 to 8 (D-5 to D-10), the class demo (D-11) and the conclusion (D-12).

### 3.2 Out of scope

- Integration with Moodle, Zoom or any personal-information system (assignment brief).
- A native mobile app: students use the phone's browser.
- Joining a lesson or a poll with a room code, or sending students to an outside poll site.
- Poll types other than multiple choice, such as open text, word clouds or quiz scoring.

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
