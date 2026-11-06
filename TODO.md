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
- [x] Add a "Repository structure" section to the README
- [x] Add a documentation guide with the lecturer's document chain and ID scheme
- [x] Align the README with the lecturer's 8 README sections
- [ ] README section 1: what the app is, in one sentence
- [ ] README section 8: license and contact

## Step 2: Technical tools report → [docs/02-tools-report.md](docs/02-tools-report.md)

The lecturer requires that we **actually test** every tool we suggest.

- [ ] Define evaluation criteria (cost / free tier, simplicity, works on smartphones, time to set up)
- [ ] List candidate tools per need:
  - [ ] Frontend / web framework
  - [ ] Backend / BaaS + realtime database
  - [ ] Spreadsheet export (CSV / Excel / Google Sheets)
  - [ ] Attendance check-in method (QR code, session code, location, etc.)
  - [ ] Hosting / deployment (public URL that works from phones)
  - [ ] LLM API (homework review)
  - [ ] Speech-to-text / video summarization (class video summary)
  - [ ] Vibe-coding tools (AI coding assistants, app generators)
- [ ] Spike (hands-on test) of each shortlisted tool: goal, what we did, result, screenshot (one commit per tool)
- [ ] Comparison table
- [ ] Decisions as ADRs: what we chose, alternatives rejected and why (one commit per decision)
- [ ] Technology risk register with mitigations (keep a fallback for risky tools)

## Step 3: SoW (Statement of Work) → [docs/03-SoW.md](docs/03-SoW.md)

The lecturer's 6 parts, in order. Avoid the 3 pitfalls: vague deliverables, no acceptance test, no out-of-scope list.

- [ ] 1. Objectives: problem, goals and background
- [ ] 2. Deliverables table with IDs (`D-1`, `D-2`, ...), each one concrete (not "a working system")
- [ ] 3. In scope + an explicit out-of-scope list
- [ ] 4. Milestones with dates up to the demo (+ Gantt chart)
- [ ] 5. Acceptance criteria for each deliverable
- [ ] 6a. Assumptions, constraints and dependencies
- [ ] 6b. Roles: RACI table (who is responsible / accountable / consulted / informed)
- [ ] 6c. Risk register (ID, risk, probability, impact, mitigation)

## Step 4: SRS (Software Requirements Specification) → [docs/04-SRS.md](docs/04-SRS.md)

Every requirement is written as "The system shall..." and must be testable: unambiguous, verifiable, complete, consistent, traceable, prioritised.

- [ ] 1. Introduction: purpose, scope, definitions, references
- [ ] 2. Overall description: product perspective, user classes (student, lecturer), operating environment (smartphone browser), constraints, assumptions
- [ ] 3.1 Functional requirements with IDs + priority + source (`D-n`), one commit per feature:
  - [ ] F1 Attendance + spreadsheet (main feature): `REQ-10` to `REQ-19`
  - [ ] F2 Comments and suggestions (realtime + offline): `REQ-20` to `REQ-29`
  - [ ] F3 Polls: `REQ-30` to `REQ-39`
  - [ ] F4 Class video ML summary: `REQ-40` to `REQ-49`
  - [ ] F5 LLM homework review and comparison: `REQ-50` to `REQ-59`
- [ ] 3.2 External interfaces (LLM API, spreadsheet export, etc.)
- [ ] 3.3 Non-functional requirements (`NFR-nn`), each one measurable: usability (KISS), performance (whole class at once), security and privacy, availability
- [ ] Review pass: rewrite any weak requirement (not measurable, subjective, vague quantity, several in one)
- [ ] Appendix B: data dictionary (main entities, spreadsheet columns)
- [ ] Appendix C: traceability matrix (requirement column; filled further in steps 5-8)

## Step 5: Main use cases (client stories) → [docs/05-use-cases.md](docs/05-use-cases.md)

- [ ] Actors list
- [ ] Use-case diagram
- [ ] UC-1: Student marks attendance
- [ ] UC-2: Lecturer opens a class session and exports the attendance spreadsheet
- [ ] UC-3: Student posts a comment / suggestion
- [ ] UC-4: Lecturer creates a poll, students vote, results are shown
- [ ] UC-5: Lecturer uploads a class video and gets a summary
- [ ] UC-6: Student / teacher requests a homework review
- [ ] User stories ("As a ... I want ... so that ...") with acceptance criteria

## Step 6: Main software components (SDD) → [docs/06-SDD.md](docs/06-SDD.md)

- [ ] High-level architecture diagram (client / server / database / external APIs)
- [ ] Component list and responsibilities (sessions, attendance, comments, polls, export, video summary, homework review)
- [ ] Interfaces between components (API endpoints / realtime events)
- [ ] Deployment diagram

## Step 7: Class diagrams and sequence diagrams (EDD) → [docs/07-EDD/](docs/07-EDD/)

Use Mermaid or PlantUML so the diagrams live in the repo as text (easy to review and commit).

- [ ] Class diagram: domain model (e.g. User, Student, Lecturer, Course, ClassSession, AttendanceRecord, Comment, Poll, Vote, VideoSummary, Homework, Review)
- [ ] Class diagram: services / controllers layer
- [ ] Sequence diagram: student marks attendance
- [ ] Sequence diagram: lecturer exports the spreadsheet
- [ ] Sequence diagram: comment in real time
- [ ] Sequence diagram: create poll + vote
- [ ] Sequence diagram: video summary
- [ ] Sequence diagram: homework review

## Step 8: Testing strategy (STP / STD) → [docs/08-STP-STD.md](docs/08-STP-STD.md)

The testing strategy must address the classes from step 7.

- [ ] Test levels: unit, integration, end-to-end, manual demo rehearsal
- [ ] Unit-test plan per class from step 7 (table: class → methods → test cases)
- [ ] Integration tests (API + database)
- [ ] End-to-end scenario: a full class flow on a smartphone
- [ ] Non-functional tests: many students at once, different mobile browsers
- [ ] Testing tools
- [ ] Traceability table: requirement (SRS) → test

## Step 9: Implement the demo web app (KISS) → [app/](app/)

- [ ] Decide: vibe code vs. find and compose existing code; document the decision, sources and licenses
- [ ] Project scaffold + `.gitignore`
- [ ] Lecturer: create a class session (QR code / session code)
- [ ] Student: join from a phone and mark attendance
- [ ] Prevent duplicate check-ins (one record per student per session)
- [ ] Lecturer: live attendance list
- [ ] Lecturer: export the attendance spreadsheet
- [ ] Comments and suggestions
- [ ] Polls
- [ ] Video summary (if in demo scope)
- [ ] Homework review (if in demo scope)
- [ ] Unit tests for the core classes (per step 8)
- [ ] Deploy to a public URL
- [ ] Add run instructions and the URL to the README

## Step 10: Demo in class (10 minutes) → [docs/10-demo-plan.md](docs/10-demo-plan.md)

- [ ] Minute-by-minute demo script
- [ ] Slide / screen with the QR code and link for the students
- [ ] At least 2 rehearsals on real phones
- [ ] Backup plan (screen recording, fallback if the network fails)
- [ ] After the demo: save the results (attendance count, poll results) without personal student data

## Step 11: Conclusion → [docs/11-conclusion.md](docs/11-conclusion.md)

- [ ] What was achieved vs. planned, per feature
- [ ] Demo results
- [ ] Lessons learned (vibe coding vs. deep design)
- [ ] Future work
- [ ] Final README pass with links to all documents

---

## Open questions for the lecturer

- [ ] Can we get a list of all the students in the class (for the attendance demo)?
