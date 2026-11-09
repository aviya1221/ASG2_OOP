# TODO: Ex2 roadmap

This roadmap follows the 11 "To Do" steps from the assignment, in order.
Each step is split into small tasks. **Every checkbox = at least one commit.**

The tasks follow the lecturer's definition of each document (lectures 02a and 03a).
The full definition sits in a hidden comment at the top of each document file. See also the
[documentation guide](docs/README.md) for the document chain, the shared ID scheme (`D-n`, `REQ-nn`, `UC-nn`, `TC-nnn`...) and which UML diagram goes where.

## Commit rules

The commit history is part of the grade, so commit small and often.

- One task per commit. Don't bundle a whole document into a single commit; commit it section by section.
- Tick the checkbox (`[ ]` → `[x]`) in the same commit that finishes the task.
- Every team member commits from their own GitHub account, so contributions show in the history.
- Pull before you start working (`git pull`) to avoid conflicts.
- Before committing a document change, run the lecturer check and fix every ERROR:
  `python .claude/skills/lecturer-doc-check/scripts/check_docs.py`
  (in Claude Code, the `lecturer-doc-check` skill runs it and also reviews the meaning).
- Message format: `<type>(<area>): <what was done>`
  - Types: `docs`, `feat`, `test`, `fix`, `refactor`, `chore`
  - Areas: `readme`, `tools`, `sow`, `srs`, `usecases`, `sdd`, `edd`, `tests`, `app`, `demo`, `conclusion`
  - Examples:
    - `docs(srs): add functional requirements for attendance`
    - `docs(edd): add sequence diagram for poll voting`
    - `feat(app): add QR check-in page for students`
    - `test(app): add unit tests for AttendanceService`

---

## Step 1: Repository, problem and scope (README)

- [x] Create the GitHub repository
- [x] Add an initial README with the problem statement and features
- [x] Add this TODO roadmap
- [x] Add the folder structure for all deliverables (`docs/`, `app/`)
- [ ] Add team members (names + GitHub usernames) to the README
- [ ] Define the scope: in scope / out of scope (no Moodle, Zoom or personal-info integration)
- [ ] Decide which of the 5 features are implemented in the demo and which are design-only
- [x] Polls (F3): agreed build strategy and reused code sources → [docs/features/F3-polls-strategy.md](docs/features/F3-polls-strategy.md)
- [x] Attendance (F1): interactive mock of the agreed flow (Hebrew) → [docs/assets/F1-attendance-flow-demo.html](docs/assets/F1-attendance-flow-demo.html)
- [x] Homework review (F5): agreed approach and decisions → [docs/features/F5-homework-review-strategy.md](docs/features/F5-homework-review-strategy.md)
- [x] Comments and suggestions (F2): agreed approach and decisions → [docs/features/F2-lesson-forum-strategy.md](docs/features/F2-lesson-forum-strategy.md)
- [x] Video summary (F4): agreed approach, decisions and test results → [docs/features/F4-lesson-summary-strategy.md](docs/features/F4-lesson-summary-strategy.md)
- [x] User interface: agreed look, screens and client tool → [docs/features/UI-strategy.md](docs/features/UI-strategy.md)
- [x] Add a "Repository structure" section to the README
- [x] Add a documentation guide with the lecturer's document chain and ID scheme
- [x] Align the README with the lecturer's 8 README sections
- [x] README section 1: what the app is, in one sentence
- [ ] README section 8: license and contact

## Step 2: Technical tools report → [docs/02-tools-report.md](docs/02-tools-report.md)

The lecturer requires that we **actually test** every tool we suggest.

- [x] Define evaluation criteria (cost / free tier, simplicity, works on smartphones, time to set up)
- [ ] List candidate tools per need:
  - [x] Frontend / web framework
  - [x] Backend / BaaS + realtime database
  - [x] Spreadsheet export (CSV / Excel / Google Sheets)
  - [x] Attendance check-in method (QR code, session code, location, etc.)
  - [x] Hosting / deployment (public URL that works from phones)
  - [ ] LLM API (homework review)
  - [x] Speech-to-text / video summarization (class video summary)
  - [x] Vibe-coding tools (AI coding assistants, app generators)
  - [x] Form builder
- [ ] Spike (hands-on test) of each shortlisted tool: goal, what we did, result, screenshot (one commit per tool)
  - [x] Face tools for photo attendance (F1): benchmark code and hands-on page → [app/spikes/face-tools/](app/spikes/face-tools/)
  - [x] Face tools for photo attendance (F1): write the spike in the report
  - [x] Face tools for photo attendance (F1): first check on compressed photos of a real lecture hall
  - [ ] Face tools for photo attendance (F1): check camera originals with registration photos from volunteers, and time it on phones
  - [x] Lesson summary (F4): scripts and measured results → [app/spikes/lesson-summary/](app/spikes/lesson-summary/)
  - [x] Lesson summary (F4): write the spike in the report
  - [x] Database and live updates (Supabase): test script and measured results → [app/spikes/backend-realtime/](app/spikes/backend-realtime/)
  - [x] Database and live updates (Supabase): write the spike in the report
  - [x] React client: test page and measured results → [app/spikes/client-react/](app/spikes/client-react/)
  - [x] React client: write the spike in the report
  - [x] Server hosting (Render): test server and measured results → [app/spikes/hosting/](app/spikes/hosting/)
  - [x] Server hosting (Render): write the spike in the report
  - [x] Attendance sheet export: test script and measured results → [app/spikes/spreadsheet-export/](app/spikes/spreadsheet-export/)
  - [x] Attendance sheet export: write the spike in the report
  - [x] Form builder (F6): test code and measured results → [app/spikes/form-builder/](app/spikes/form-builder/)
  - [x] Form builder (F6): write the spike in the report
  - [x] AI coding assistant: write the spike in the report
- [ ] Comparison table
  - [x] Face tools for photo attendance (F1)
  - [x] Lesson summary (F4)
  - [x] Database and live updates (Supabase)
  - [x] React client
  - [x] Server hosting (Render)
  - [x] Attendance sheet export
  - [x] Form builder
  - [x] AI coding assistant
- [ ] Decisions as ADRs: what we chose, alternatives rejected and why (one commit per decision)
  - [x] ADR-1: face tool for photo attendance (F1)
  - [x] ADR-2: source and service for the lesson summary (F4)
  - [x] ADR-3: database, sign-in, files and live updates
  - [x] ADR-4: web client
  - [x] ADR-4: where the web client is hosted (Netlify)
  - [x] ADR-5: hosting the server
  - [x] ADR-6: attendance sheet file
  - [x] ADR-7: form builder
  - [x] ADR-8: way of building
- [ ] Technology risk register with mitigations (keep a fallback for risky tools)
  - [x] Face tools for photo attendance (F1): R1 to R6
  - [x] Lesson summary (F4): R7 to R10
  - [x] Database and live updates (Supabase): R11 to R13
  - [x] React client: R14
  - [x] Server hosting (Render): R15 and R16
  - [x] Attendance sheet export: R17
  - [x] Form builder: R18
  - [x] AI coding assistant: R19
  - [x] Checks left for real phones: R20 and R21
  - [x] Web client hosting (Netlify): R22
- [x] Track the work left for later → [docs/left-for-later.md](docs/left-for-later.md)

## Step 3: SoW (Statement of Work) → [docs/03-SoW.md](docs/03-SoW.md)

The SoW answers only why, what is delivered and at what cost.

- [x] 1. Why: the problem and the goal
- [x] 2. What: deliverables table with IDs (`D-1`, `D-2`, ...), each one concrete (not "a working system")
- [x] 3. How much: cost in money and effort
- [x] The deliverables are the 5 assignment features (D-1 to D-5, same order as F1 to F5), not the work documents

## Step 4: SRS (Software Requirements Specification) → [docs/04-SRS.md](docs/04-SRS.md)

Every requirement is written as "The system shall..." and must be testable: unambiguous, verifiable, complete, consistent, traceable, prioritised.

- [x] 1. Introduction: purpose, scope, definitions, references
- [x] 2. Overall description: product perspective, user classes (admin, teacher, student), operating environment (smartphone browser), constraints, assumptions
- [x] 3.1 Functional requirements with IDs + priority + source (`D-n`), one commit per feature:
  - [x] F0 Accounts, timetable and lesson page: `REQ-01` to `REQ-09`
  - [x] F1 Attendance + spreadsheet (main feature): `REQ-10` to `REQ-19`
  - [x] F2 Comments and suggestions (realtime + offline): `REQ-20` to `REQ-29`, and `REQ-70` (expanded window)
  - [x] F3 Polls: `REQ-30` to `REQ-39`
  - [x] F4 Class video ML summary: `REQ-40` to `REQ-49`
  - [x] F5 LLM homework review and comparison: `REQ-50` to `REQ-59`
  - [x] F6 Forms: `REQ-60` to `REQ-69`
- [x] 3.2 External interfaces (LLM API, spreadsheet export, etc.)
- [x] 3.3 Non-functional requirements (`NFR-nn`), each one measurable: usability (KISS), performance (whole class at once), security and privacy, availability
- [x] Review pass: rewrite any weak requirement (not measurable, subjective, vague quantity, several in one)
- [x] Appendix B: data dictionary (main entities, spreadsheet columns)
- [x] Appendix C: traceability matrix (requirement column; filled further in steps 5-8)

## Step 5: Main use cases (client stories) → [docs/05-use-cases.md](docs/05-use-cases.md)

Each use case has the lecturer's 6 fields: name and ID, actor, preconditions, main success flow, alternative flows, postconditions (+ the `REQ-nn` it covers).

- [x] Actors list
- [x] Use-case diagram (actors, system boundary, `<<include>>` / `<<extend>>`)
- [x] UC-01: Take attendance in a lesson
- [x] UC-02: Post a message in the forum
- [x] UC-03: Publish a poll or form and answer it
- [x] UC-04: Get a lesson summary
- [x] UC-05: Publish a homework and get feedback on it
- [x] UC-06: Register a face
- [x] UC-07: Build the timetable
- [x] UC-08: Sign in and reach a lesson page
- [x] Activity diagram for UC-01 (the main feature)
- [x] User stories ("As a ... I want ... so that ...") with Given / When / Then acceptance criteria
- [x] Fill the "Use case" column of the SRS traceability matrix

## Step 6: Main software components (SDD) → [docs/06-SDD.md](docs/06-SDD.md)

The SDD describes the whole system: "What are the parts?"

- [x] 1. Context: users and external systems (+ context diagram)
- [x] 2. Decomposition: component diagram + one numbered subsection per component (sessions, attendance, comments, polls, export, video summary, homework review)
- [x] 3. Interfaces: how components communicate (API endpoints / realtime events / external APIs)
- [x] 4. Data: main entities and storage
- [x] 5. Deployment diagram (phones, lecturer laptop, server, external APIs)
- [x] 6. Rationale: alternatives and why this one (link to the ADRs from step 2)
- [x] 7. Requirement allocation: every `REQ-nn` assigned to a component + fill the "Design" column of the traceability matrix

## Step 7: Class diagrams and sequence diagrams (EDD) → [docs/07-EDD/](docs/07-EDD/)

The EDD describes one component: "How is this part built?" One file per component, copied from [`_template.md`](docs/07-EDD/_template.md) (the lecturer's 8 EDD sections). Diagrams in Mermaid.

- [x] Class diagram: domain model (e.g. User, Student, Lecturer, Course, ClassSession, AttendanceRecord, Comment, Poll, Vote, VideoSummary, Homework, Review)
- [x] EDD-Attendance (main feature), one commit per section:
  - [x] Class design (class diagram, incl. services / controllers)
  - [x] Sequence diagram: student marks attendance
  - [x] Sequence diagram: lecturer exports the spreadsheet
  - [x] Data format: spreadsheet columns, database schema
  - [x] Error handling and edge cases (duplicate check-in, session closed, no network)
- [x] EDD-Forum: class design + sequence diagram (comment in real time)
- [x] EDD-Polls: class design + sequence diagram (create poll + vote) + state machine (poll lifecycle)
- [x] EDD-LessonSummary: class design + sequence diagram
- [ ] EDD-HomeworkReview: class design + sequence diagram
- [x] API docs: endpoints, requests / responses, errors, examples
- [ ] Fill the "Design" column of the traceability matrix with the EDD names

## Step 8: Testing strategy (STP / STD) → [docs/08-STP-STD.md](docs/08-STP-STD.md)

The testing strategy must address the classes from step 7. STP = how we will test; STD = the test cases themselves.

**Part A: STP (test plan)**
- [x] A.1 Scope and items under test
- [x] A.2 Test levels: unit, integration, system, acceptance
- [x] A.3 Unit-test plan per class from step 7 (table: EDD → class → method → test cases)
- [x] A.4 Approach and tools
- [x] A.5 Environment and test data (phones, browsers, fake students, no real personal data)
- [x] A.6 Entry and exit criteria (when are we done?)
- [x] A.7 Schedule, roles and risks

**Part B: STD (test cases)**, each one: ID, title, requirement it verifies, preconditions, steps, input data, expected result
- [x] Test cases for F1 Attendance (`TC-0xx`)
- [ ] Test cases for the other features in demo scope (one commit per feature)
- [x] Test cases for state transitions (state machines from step 7)
- [x] Non-functional test cases: many students at once, different mobile browsers
- [ ] Fill the "Test cases" column of the traceability matrix: no Gap for requirements in demo scope

## Step 9: Implement the demo web app (KISS) → [app/](app/)

Lecturer's definition of done: **a feature is not done until its docs and tests are updated.** Build attendance end to end first (a "vertical slice").

- [x] Decide: vibe code vs. find and compose existing code; document the decision, sources and licenses
- [x] Project scaffold + `.gitignore`
- [ ] LLM layer (used by the video summary and the homework review), behind one interface so the provider can be swapped or mocked (lecture 03a, risk R4):
  - [x] Provider-neutral contract: interface, request and result types, errors, a fake client for tests and an offline demo
  - [x] Gemini adapter: official Google Gen AI SDK, Interactions API, file upload, embeddings
  - [x] Settings from environment variables + one place that builds the shared services
  - [x] Unit tests with a fake SDK (no network, no API key)
  - [x] Smoke script: one real call with our key (evidence for the step 2 spike)
  - [x] Document the LLM layer in `app/README.md` (structure, settings, reused libraries)
- [ ] Only if we find we need it: Sign in with Google. Removed for now to keep the product simple; the server check and the Google Cloud setup guide can be restored from commits `173a8e6` and `3222230`.
- [ ] Base of the product
  - [x] Local database (Supabase in Docker)
  - [x] Database: accounts and timetable, with access rules
  - [x] Test data: made-up users and lessons
  - [x] Server: Express, health check, sign-in check, allowed callers
  - [x] Integration tests of accounts and the timetable
  - [x] Web client: sign-in and first sign-in
  - [ ] Web client: the user's lessons, and the lesson page with three tabs
  - [ ] Web client: the admin's timetable and a form for a new course
  - [ ] Browser tests of accounts and the timetable
- [ ] Teacher: photograph the class and start the hour of responses
- [ ] Student: register a face, and respond from a phone
- [ ] One result per student per lesson
- [ ] Teacher: live attendance sheet
- [ ] Teacher: download the attendance sheet
- [ ] Comments and suggestions
- [ ] Polls
- [ ] Video summary (if in demo scope)
- [ ] Homework review (if in demo scope)
- [ ] Unit tests for the core classes (per the STP, step 8)
- [ ] Test automation: GitHub Actions runs the type check and the unit, integration and browser tests on every push
- [ ] Test IDs in the test names, and a script that writes Passed or Failed into the traceability matrix
- [ ] Test data: made-up users, generated face-prints and generated photos of people who do not exist
- [ ] Run the STD test cases and record Pass / Fail + update the traceability matrix status
- [ ] Deploy to a public URL
- [ ] README section 2: quick start (install and run, public URL)
- [ ] README section 3: usage example
- [ ] README section 4: configuration and environment
- [ ] README section 5: how to run the tests

## Step 10: Demo in class (10 minutes) → [docs/10-demo-plan.md](docs/10-demo-plan.md)

Lecturer's golden rule: **demo the requirements, not the code.** Every minute maps to a requirement or a result.

- [ ] Demo script: context → live scenario (use cases) → evidence (results vs. requirements and tests) → lessons → Q&A, each row tied to `UC-nn` / `REQ-nn`
- [ ] Freeze a tagged release days before the demo (`git tag`)
- [ ] Seed realistic demo data
- [ ] Slide / screen with the link for the students
- [ ] Rehearse twice with a timer, on real phones (log each rehearsal)
- [ ] Record a backup video + plan B for network and hardware
- [ ] List known issues to state openly
- [ ] After the demo: save the results (attendance count, poll results) without personal student data

## Step 11: Conclusion → [docs/11-conclusion.md](docs/11-conclusion.md)

Short, per the assignment. Lecturer's closing: accept, hand over, learn.

- [ ] Results summary
- [ ] Plan vs. actual per deliverable (`D-n`), against the SoW acceptance criteria; also time and effort
- [ ] Demo results
- [ ] Retrospective: keep / stop / start (incl. vibe coding vs. deep design)
- [ ] Future work
- [ ] Handover check: repository, README, documents and deployment notes are all up to date

---

## Open questions for the lecturer

- [ ] Can we get a list of all the students in the class (for the attendance demo)?
